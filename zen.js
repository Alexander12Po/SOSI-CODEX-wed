import 'dotenv/config'
import http from 'http'
import {
  makeWASocket,
  fetchLatestWaWebVersion,
  DisconnectReason
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import readline from 'readline'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import NodeCache from 'node-cache'
import { handler } from './handler.js'
import { botConfig } from './config.js'
import { handleGroupParticipantsUpdate } from './plugins/bienvenida.js'
import { cachearMensaje, manejarMensajeEliminado } from './plugins/antidelete.js'
import { useMongoAuthState, listRegisteredSessions } from './mongoAuthState.js'
import { restoreAllSessions } from './sessionManager.js'

// -----------------------------------------------------------------------
// El QR en ASCII dentro de los Logs de Render es casi imposible de
// escanear desde el celular (se ve pixelado y chiquito). Por eso además
// de imprimirlo en los logs, lo guardamos como imagen y lo servimos en
// la ruta /qr, para que lo abras en el navegador y lo escanees nítido.
// -----------------------------------------------------------------------
let ultimoQR = null

// -----------------------------------------------------------------------
// Render (plan free) apaga cualquier Web Service que no reciba tráfico
// HTTP durante 15 minutos. El bot de WhatsApp no recibe tráfico HTTP por
// sí mismo, así que abrimos un servidor mínimo que responde "OK" a
// cualquier petición. Un servicio externo (cron-job.org, UptimeRobot,
// etc.) le pega a esta URL cada 10-14 minutos para que Render nunca lo
// vea inactivo. Render inyecta el puerto correcto en process.env.PORT.
// -----------------------------------------------------------------------
const PORT = process.env.PORT || 3000
http.createServer(async (req, res) => {
  if (req.url === '/qr') {
    if (!ultimoQR) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      return res.end('<h2>Todavía no hay QR generado, o el bot ya está conectado. Refresca en unos segundos.</h2>')
    }
    const dataUrl = await QRCode.toDataURL(ultimoQR, { width: 300 })
    res.writeHead(200, { 'Content-Type': 'text/html' })
    return res.end(`
      <html>
        <body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif;margin-top:40px">
          <h3>Escanea con WhatsApp &gt; Dispositivos vinculados</h3>
          <img src="${dataUrl}" width="300" height="300" />
          <p>Se actualiza solo. Si expira, refresca la página.</p>
          <script>setTimeout(() => location.reload(), 15000)</script>
        </body>
      </html>
    `)
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('SOSI CODEX activo ✅')
}).listen(PORT, () => {
  console.log(`🌐 Servidor keep-alive escuchando en el puerto ${PORT}`)
})

// --- BLINDAJE GLOBAL: evita que errores no capturados tumben el bot ---
process.on('uncaughtException', (err) => {
  console.error('⚠️ Error no capturado (uncaughtException):', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Promesa rechazada no manejada (unhandledRejection):', reason)
})
// -----------------------------------------------------------------------

const question = (text) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.question(text, (answer) => {
    rl.close()
    resolve(answer)
  })
})

async function startBot() {
  // 👇 Antes: useMultiFileAuthState('./session') — se perdía en cada
  // redeploy de Render porque el disco es efímero.
  // Ahora: la sesión se lee/escribe directamente en MongoDB, así que
  // sobrevive a reinicios y redeploys.
  const { state, saveCreds } = await useMongoAuthState()

  const { version } = await fetchLatestWaWebVersion()

  const usePairing = botConfig.loginMethod === 'pairing'

  const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: ['SOSI CODEX', 'Chrome', '1.0.0'],
    cachedGroupMetadata: async (jid) => groupCache.get(jid)
  })

  let pairingRequested = false
  let phoneNumber = null

  if (usePairing && !sock.authState.creds.registered) {
    // En Render no hay terminal interactiva para escribir el número a mano.
    // Si definiste PAIRING_NUMBER como variable de entorno, se usa esa.
    // Si no existe (por ejemplo corriendo local), se pregunta por consola.
    phoneNumber = process.env.PAIRING_NUMBER
      ? process.env.PAIRING_NUMBER.trim()
      : (await question('Ingresa tu número con código de país (ej: 521234567890): ')).trim()
  }

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (!usePairing && qr) {
      ultimoQR = qr
      console.log('📲 Escanea este código QR con WhatsApp > Dispositivos vinculados:')
      console.log(`🌐 O ábrelo como imagen en: (tu URL de Render)/qr`)
      qrcode.generate(qr, { small: true })
    }

    if (usePairing && phoneNumber && !pairingRequested && (connection === 'connecting' || qr)) {
      pairingRequested = true
      try {
        const code = await sock.requestPairingCode(phoneNumber)
        console.log('╭───────────────────────╮')
        console.log(`   🔑 Código: ${code}`)
        console.log('╰───────────────────────╯')
        console.log('Ve a WhatsApp > Dispositivos vinculados > Vincular con número de teléfono, e ingresa el código.')
      } catch (err) {
        console.log('❌ Error generando el código:', err.message || err)
        pairingRequested = false
      }
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      console.log('❌ Conexión cerrada. Código:', statusCode, '| Motivo:', lastDisconnect?.error?.message || lastDisconnect?.error)
      console.log(shouldReconnect ? 'Reconectando...' : 'Sesión cerrada, se necesita vincular de nuevo.')
      if (shouldReconnect) startBot()
    } else if (connection === 'open') {
      console.log(`✅ ${botConfig.botName} conectado correctamente`)
    }
  })

  sock.ev.on('messages.upsert', async (m) => {
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