import 'dotenv/config'
import http from 'http'
import {
  makeWASocket,
  Browsers,
  fetchLatestWaWebVersion,
  DisconnectReason
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import NodeCache from 'node-cache'
import { handler } from './handler.js'
import { botConfig } from './config.js'
import { handleGroupParticipantsUpdate } from './plugins/bienvenida.js'
import { cachearMensaje, manejarMensajeEliminado } from './plugins/antidelete.js'
import { useMongoAuthState, listRegisteredSessions, clearMongoAuthState } from './mongoAuthState.js'
import { restoreAllSessions } from './sessionManager.js'
import { guardarViewOnce } from './vvCache.js'

// -----------------------------------------------------------------------
// IDENTIDAD DEL DISPOSITIVO VINCULADO
// WhatsApp NO entrega el contenido de los "ver una vez" a los dispositivos
// vinculados tipo web/Chrome (el mensaje llega vacío). Solo lo entrega a los
// que se identifican como Android. Por eso antes el .vv nunca encontraba nada.
//
// La identidad se fija al VINCULAR: si la cambias, hay que cerrar la sesión
// del bot en el celular (Dispositivos vinculados) y vincular de nuevo.
// Requiere @whiskeysockets/baileys 7.0.0-rc14 o más nuevo.
// -----------------------------------------------------------------------
const TIENE_PRESET_ANDROID = typeof Browsers.android === 'function'
const IDENTIDAD_BOT = TIENE_PRESET_ANDROID
  ? Browsers.android('Android')
  : ['Android', 'Android', '14'] // seguro: si Baileys es viejo, no se cae

// -----------------------------------------------------------------------
// ESTADO DE LA VINCULACIÓN (lo lee el panel web /qr)
// -----------------------------------------------------------------------
let ultimoQR = null        // texto del QR actual (null si no hay, o si ya está conectado)
let botConectado = false   // true cuando WhatsApp confirmó la conexión
let ultimoPedidoCodigo = 0 // para no pedir códigos en ráfaga

// -----------------------------------------------------------------------
// Contador de reconexiones fallidas seguidas. Si Baileys no detecta un
// logout "limpio" (401) pero las credenciales igual están inválidas
// (por ejemplo, sesión vinculada a otro WhatsApp, o error 515/428 en
// loop), el bot se queda reconectando infinitamente sin nunca borrar
// Mongo. Con este contador, si falla muchas veces seguidas en poco
// tiempo, forzamos el borrado y pedimos QR nuevo automáticamente.
// -----------------------------------------------------------------------
let intentosFallidosSeguidos = 0
const MAX_INTENTOS_ANTES_DE_RESET = 5

// Anti-choque de deploy en Render: el contenedor viejo y el nuevo usan la
// misma sesión. Un 440 (conflict) es normal durante unos segundos, NO
// significa credenciales rotas, así que no cuenta para el reset.
// ID de la sesión principal en Mongo. Se puede cambiar con la variable de
// entorno SESSION_ID (en Render) para aislarse de otra copia del bot que
// siga usando la sesión 'main'.
const SESSION_ID = process.env.SESSION_ID || 'main'

let conflictosSeguidos = 0
let cerrandoApp = false
let sockActual = null

// Cuando Render apaga el contenedor viejo (SIGTERM), cerramos el socket
// y dejamos de reconectar para no pelear con el contenedor nuevo.
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recibido (deploy). Cerrando WhatsApp sin tocar la sesión...')
  cerrandoApp = true
  try { sockActual?.end(undefined) } catch {}
  setTimeout(() => process.exit(0), 1500)
})

// -----------------------------------------------------------------------
// 🆕 CLAVE OPCIONAL DEL PANEL
// Si creas la variable PANEL_KEY en Render, las rutas /qr, /codigo y
// /reset-session solo funcionan con la clave:
//   https://tu-app.onrender.com/qr?key=TU_CLAVE
// Sin clave, cualquiera que conozca el enlace podría vincular o resetear
// tu bot. La ruta "/" (keep-alive) sigue siendo pública.
// -----------------------------------------------------------------------
const PANEL_KEY = process.env.PANEL_KEY || ''
const autorizado = (url) => !PANEL_KEY || url.searchParams.get('key') === PANEL_KEY
if (!PANEL_KEY) {
  console.log('⚠️ PANEL_KEY no está definida: cualquiera con el enlace /qr puede vincular o resetear el bot.')
}

function responderJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(obj))
}

function leerJSON(req, maxBytes = 2048) {
  return new Promise((resolve, reject) => {
    let datos = ''
    req.on('data', (chunk) => {
      datos += chunk
      if (datos.length > maxBytes) {
        reject(new Error('Cuerpo demasiado grande'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try { resolve(datos ? JSON.parse(datos) : {}) } catch { reject(new Error('JSON inválido')) }
    })
    req.on('error', reject)
  })
}

// -----------------------------------------------------------------------
// 🆕 CÓDIGO DE VINCULACIÓN (alternativa al QR)
// Pide a WhatsApp un código de 8 caracteres para el número indicado. Se
// escribe en: WhatsApp > Dispositivos vinculados > Vincular un dispositivo >
// Vincular con el número de teléfono. Solo funciona mientras el bot NO está
// vinculado y ya está conectado a WhatsApp esperando (cuando hay un QR).
// -----------------------------------------------------------------------
async function generarCodigoVinculacion(numeroCrudo) {
  let numero = String(numeroCrudo || '').replace(/\D/g, '')
  if (numero.length === 9 && numero.startsWith('9')) numero = '51' + numero // solo 9 dígitos: se asume Perú
  if (numero.length < 8 || numero.length > 15) {
    return { status: 400, error: 'Número inválido. Escríbelo con código de país, sin + ni espacios (Perú: 51 + tu número).' }
  }
  if (botConectado || sockActual?.authState?.creds?.registered) {
    return { status: 409, error: 'El bot ya está vinculado. Para vincular otro número, cierra su sesión en WhatsApp > Dispositivos vinculados.' }
  }
  if (!sockActual || !ultimoQR) {
    return { status: 503, error: 'El bot todavía se está conectando a WhatsApp. Espera unos segundos e intenta otra vez.' }
  }
  const ahora = Date.now()
  if (ahora - ultimoPedidoCodigo < 8000) {
    return { status: 429, error: 'Espera unos segundos antes de pedir otro código.' }
  }
  ultimoPedidoCodigo = ahora
  try {
    const codigo = await sockActual.requestPairingCode(numero)
    const legible = codigo.match(/.{1,4}/g)?.join('-') || codigo
    console.log(`🔑 Código de vinculación para +${numero}: ${legible}`)
    return { status: 200, ok: true, numero, codigo: legible }
  } catch (err) {
    ultimoPedidoCodigo = 0
    console.log('❌ Error generando el código:', err?.message || err)
    return { status: 500, error: 'No se pudo generar el código (' + (err?.message || 'error desconocido') + '). Prueba otra vez o usa el QR.' }
  }
}

// -----------------------------------------------------------------------
// 🆕 PÁGINA /qr con dos opciones: QR y Código.
// El QR se refresca solo cada 3 segundos (sin recargar la página, así no se
// borra el número que estás escribiendo). OJO: dentro de este texto no uses
// comillas invertidas ni el signo de dólar con llaves.
// -----------------------------------------------------------------------
const PAGINA_VINCULAR = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vincular bot</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px 16px; display: flex; flex-direction: column; align-items: center; }
  .caja { width: 100%; max-width: 360px; text-align: center; }
  .tabs { display: flex; gap: 8px; margin: 12px 0 20px; }
  .tabs button { flex: 1; padding: 12px; font-size: 16px; border: 1px solid #888; border-radius: 10px; background: transparent; color: inherit; }
  .tabs button.activo { background: #25d366; border-color: #25d366; color: #000; font-weight: 600; }
  #qr { width: 280px; height: 280px; background: #fff; padding: 8px; border-radius: 12px; box-sizing: content-box; }
  input { width: 100%; box-sizing: border-box; padding: 12px; font-size: 18px; border-radius: 10px; border: 1px solid #888; margin: 8px 0; }
  .btn { width: 100%; padding: 12px; font-size: 16px; font-weight: 600; border: 0; border-radius: 10px; background: #25d366; color: #000; }
  .btn:disabled { opacity: .5; }
  #codigo { font-size: 38px; letter-spacing: 3px; font-family: ui-monospace, monospace; font-weight: 700; margin: 16px 0 8px; }
  .nota { font-size: 14px; opacity: .8; }
  .error { color: #e5484d; opacity: 1; }
  .oculto { display: none; }
</style>
</head>
<body>
<div class="caja">
  <h2>Vincular el bot</h2>

  <div id="listo" class="oculto">
    <h3>✅ Bot conectado</h3>
    <p class="nota">Ya no necesitas QR ni código.</p>
  </div>

  <div id="vincular">
    <div class="tabs">
      <button id="tab-qr" class="activo" onclick="ver('qr')">📷 QR</button>
      <button id="tab-codigo" onclick="ver('codigo')">🔢 Código</button>
    </div>

    <div id="p-qr">
      <img id="qr" alt="QR de WhatsApp" class="oculto">
      <p id="estado" class="nota">Conectando con WhatsApp…</p>
      <p class="nota">WhatsApp &gt; Dispositivos vinculados &gt; Vincular un dispositivo</p>
    </div>

    <div id="p-codigo" class="oculto">
      <p class="nota">Escribe tu número con código de país, sin + ni espacios.<br>Perú: 51 + tu número (si pones solo 9 dígitos, se asume +51).</p>
      <input id="numero" type="tel" inputmode="numeric" placeholder="51987654321" autocomplete="tel">
      <button id="btn" class="btn" onclick="pedir()">Generar código</button>
      <div id="codigo"></div>
      <p id="msg" class="nota"></p>
      <p class="nota">WhatsApp &gt; Dispositivos vinculados &gt; Vincular un dispositivo &gt; Vincular con el número de teléfono</p>
    </div>
  </div>
</div>

<script>
  var KEY = new URLSearchParams(location.search).get('key') || '';
  function el(id) { return document.getElementById(id); }

  function ver(tab) {
    el('p-qr').className = tab === 'qr' ? '' : 'oculto';
    el('p-codigo').className = tab === 'codigo' ? '' : 'oculto';
    el('tab-qr').className = tab === 'qr' ? 'activo' : '';
    el('tab-codigo').className = tab === 'codigo' ? 'activo' : '';
  }

  function actualizar() {
    fetch('/qr-data?key=' + encodeURIComponent(KEY))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { el('estado').textContent = d.error; return; }
        if (d.estado === 'conectado') {
          el('vincular').className = 'oculto';
          el('listo').className = '';
          return;
        }
        el('vincular').className = '';
        el('listo').className = 'oculto';
        if (d.estado === 'qr') {
          el('qr').src = d.qr;
          el('qr').className = '';
          el('estado').textContent = 'Escanéalo con WhatsApp (se renueva solo)';
        } else {
          el('qr').className = 'oculto';
          el('estado').textContent = 'Conectando con WhatsApp… espera unos segundos';
        }
      })
      .catch(function () { el('estado').textContent = 'Sin conexión con el servidor…'; });
  }

  function pedir() {
    el('msg').className = 'nota';
    el('msg').textContent = 'Generando…';
    el('codigo').textContent = '';
    el('btn').disabled = true;
    fetch('/codigo?key=' + encodeURIComponent(KEY), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: el('numero').value })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        el('btn').disabled = false;
        if (d.ok) {
          el('codigo').textContent = d.codigo;
          el('msg').textContent = 'Código para +' + d.numero + '. Escríbelo en WhatsApp ahora, dura pocos minutos.';
        } else {
          el('msg').className = 'nota error';
          el('msg').textContent = d.error || 'No se pudo generar el código.';
        }
      })
      .catch(function () {
        el('btn').disabled = false;
        el('msg').className = 'nota error';
        el('msg').textContent = 'Error de conexión. Intenta otra vez.';
      });
  }

  actualizar();
  setInterval(actualizar, 3000);
</script>
</body>
</html>`

// -----------------------------------------------------------------------
// Render (plan free) apaga cualquier Web Service que no reciba tráfico
// HTTP durante 15 minutos. El bot de WhatsApp no recibe tráfico HTTP por
// sí mismo, así que abrimos un servidor mínimo que responde "OK" a
// cualquier petición. Un servicio externo (cron-job.org, UptimeRobot,
// etc.) le pega a esta URL cada 10-14 minutos para que Render nunca lo
// vea inactivo. Render inyecta el puerto correcto en process.env.PORT.
//
// Rutas:
//   /              -> keep-alive ("SOSI CODEX activo")
//   /qr            -> panel para vincular con QR o con código
//   /qr-data       -> estado y QR actual (lo usa el panel)
//   /codigo (POST) -> genera el código de vinculación para un número
//   /reset-session -> borra la sesión y fuerza un QR nuevo
// -----------------------------------------------------------------------
const PORT = process.env.PORT || 3000
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    const ruta = url.pathname

    if (['/qr', '/qr-data', '/codigo', '/reset-session'].includes(ruta) && !autorizado(url)) {
      return responderJSON(res, 401, { ok: false, error: 'Falta la clave. Abre el enlace con ?key=TU_CLAVE' })
    }

    if (ruta === '/reset-session') {
      await clearMongoAuthState(SESSION_ID)
      ultimoQR = null
      intentosFallidosSeguidos = 0
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('✅ Sesión borrada de Mongo. El bot generará un QR nuevo en unos segundos, revisa /qr')
      console.log('🗑️ Sesión "main" borrada manualmente vía /reset-session')
      // 🆕 Cierra el socket actual para que reconecte ya con la sesión vacía
      try { sockActual?.end(undefined) } catch {}
      return
    }

    if (ruta === '/qr') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      return res.end(PAGINA_VINCULAR)
    }

    if (ruta === '/qr-data') {
      if (botConectado) return responderJSON(res, 200, { estado: 'conectado' })
      if (ultimoQR) {
        const qr = await QRCode.toDataURL(ultimoQR, { width: 300, margin: 1 })
        return responderJSON(res, 200, { estado: 'qr', qr })
      }
      return responderJSON(res, 200, { estado: 'conectando' })
    }

    if (ruta === '/codigo') {
      if (req.method !== 'POST') return responderJSON(res, 405, { ok: false, error: 'Usa el botón de la página /qr' })
      const cuerpo = await leerJSON(req)
      const r = await generarCodigoVinculacion(cuerpo.numero)
      return responderJSON(res, r.status, { ok: !!r.ok, numero: r.numero, codigo: r.codigo, error: r.error })
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('SOSI CODEX activo ✅')
  } catch (err) {
    console.error('⚠️ Error en el servidor web:', err)
    if (!res.headersSent) responderJSON(res, 500, { ok: false, error: 'Error interno del servidor' })
    else res.end()
  }
}).listen(PORT, () => {
  console.log(`🌐 Servidor escuchando en el puerto ${PORT} (panel de vinculación en /qr)`)
})

// --- BLINDAJE GLOBAL: evita que errores no capturados tumben el bot ---
process.on('uncaughtException', (err) => {
  console.error('⚠️ Error no capturado (uncaughtException):', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Promesa rechazada no manejada (unhandledRejection):', reason)
})
// -----------------------------------------------------------------------

async function startBot() {
  const commit = (process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7)
  const instancia = process.env.RENDER_INSTANCE_ID || 'local'
  console.log(`🚀 Iniciando bot | sesión: ${SESSION_ID} | commit: ${commit} | instancia: ${instancia}`)
  // Para comprobar en los logs de Render que la identidad Android quedó activa
  console.log(`🪪 Identidad: ${JSON.stringify(IDENTIDAD_BOT)} | preset android: ${TIENE_PRESET_ANDROID ? 'sí' : 'NO (Baileys viejo: sube a 7.0.0-rc14 y borra package-lock.json)'}`)

  // 👇 Antes: useMultiFileAuthState('./session') — se perdía en cada
  // redeploy de Render porque el disco es efímero.
  // Ahora: la sesión se lee/escribe directamente en MongoDB, así que
  // sobrevive a reinicios y redeploys.
  const { state, saveCreds } = await useMongoAuthState(SESSION_ID)

  const { version } = await fetchLatestWaWebVersion()

  const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: IDENTIDAD_BOT,
    cachedGroupMetadata: async (jid) => groupCache.get(jid)
  })

  sockActual = sock

  let avisoQRMostrado = false

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    // 🆕 Siempre guardamos el QR para el panel /qr (antes dependía de loginMethod).
    // El código de vinculación se pide desde el mismo panel, sin consola.
    if (qr) {
      ultimoQR = qr
      if (!avisoQRMostrado) {
        avisoQRMostrado = true
        console.log('📲 Bot sin vincular. Abre (tu URL de Render)/qr para vincular con QR o con código.')
      }
      // El QR en ASCII llena los logs; solo si pones QR_EN_LOGS=si en Render
      if (process.env.QR_EN_LOGS === 'si') qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      botConectado = false
      ultimoQR = null

      if (cerrandoApp) return

      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      console.log('❌ Conexión cerrada. Código:', statusCode, '| Motivo:', lastDisconnect?.error?.message || lastDisconnect?.error)

      // 440 = conflicto (otra instancia usando la misma sesión, típico en
      // un deploy). Esperamos con backoff y NO borramos nada de Mongo.
      if (statusCode === DisconnectReason.connectionReplaced) {
        conflictosSeguidos++
        const espera = Math.min(10000 * conflictosSeguidos, 60000)
        console.log(`⚠️ Conflicto 440 #${conflictosSeguidos} (probable deploy). Reintento en ${espera / 1000}s. La sesión NO se borra.`)
        setTimeout(() => { if (!cerrandoApp) startBot() }, espera)
        return
      }
      conflictosSeguidos = 0

      if (shouldReconnect) {
        intentosFallidosSeguidos++
        console.log(`Reconectando... (intento fallido ${intentosFallidosSeguidos}/${MAX_INTENTOS_ANTES_DE_RESET})`)

        if (intentosFallidosSeguidos >= MAX_INTENTOS_ANTES_DE_RESET) {
          console.log('⚠️ Demasiados intentos fallidos seguidos. Las credenciales guardadas parecen inválidas.')
          console.log('Borrando sesión de Mongo automáticamente y generando QR nuevo...')
          ultimoQR = null
          intentosFallidosSeguidos = 0
          await clearMongoAuthState(SESSION_ID)
        }

        setTimeout(() => { if (!cerrandoApp) startBot() }, 3000)
      } else {
        console.log('Sesión cerrada, borrando credenciales viejas y generando QR nuevo...')
        ultimoQR = null
        intentosFallidosSeguidos = 0
        await clearMongoAuthState(SESSION_ID)
        startBot()
      }
    } else if (connection === 'open') {
      botConectado = true
      ultimoQR = null
      console.log(`✅ ${botConfig.botName} conectado correctamente | commit: ${commit} | instancia: ${instancia}`)
      intentosFallidosSeguidos = 0
      conflictosSeguidos = 0
    }
  })

  sock.ev.on('messages.upsert', async (m) => {
    // Guarda los "ver una sola vez" de TODOS los mensajes del lote
    // (notify y append), antes de cualquier filtro. Es para el comando .vv
    for (const x of m.messages || []) {
      // Si WhatsApp no entrega el contenido de un "ver una vez", el mensaje
      // llega SIN x.message. Este aviso te dice que el problema es de WhatsApp
      // (identidad del dispositivo) y no del código de vvCache.js.
      if (!x.message && (x.key?.isViewOnce || x.messageStubParameters?.[0] === 'Message absent from node')) {
        console.log('📭 Llegó un "ver una vez" VACÍO (WhatsApp no entregó el contenido a este dispositivo). id:', x.key?.id)
      }
      guardarViewOnce(sock, x).catch((err) => console.error('Error guardando view-once:', err.message))
    }

    if (m.type !== 'notify') return

    const msg = m.messages[0]
    if (!msg?.message) return

    try {
      if (msg.message.protocolMessage?.type === 0 /* REVOKE */) {
        await manejarMensajeEliminado(sock, msg)
        return
      }

      cachearMensaje(msg).catch((err) => console.error('Error cacheando mensaje:', err.message))

      await handler(sock, m)
    } catch (err) {
      console.error('Error en handler:', err)
    }
  })

  sock.ev.on('group-participants.update', async (update) => {
    try {
      await handleGroupParticipantsUpdate(sock, update)
    } catch (err) {
      console.error('Error en evento de bienvenida:', err)
    }
  })
}

// Espera un poco a que el bot principal se estabilice antes de
// intentar restaurar las sesiones de sub-usuarios, para evitar conflictos.
startBot()
setTimeout(() => {
  restoreAllSessions(listRegisteredSessions)
}, 5000)
