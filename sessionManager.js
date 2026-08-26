import {
  makeWASocket,
  fetchLatestWaWebVersion,
  DisconnectReason
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import QRCode from 'qrcode'
import { useMongoAuthState } from './mongoAuthState.js'
// 👇 NO se importa handler.js de forma estática aquí. handler.js carga
// los plugins (incluido conectar.js, que depende de este archivo), así
// que un import estático crea un ciclo: handler.js -> conectar.js ->
// sessionManager.js -> handler.js, y Node se queda esperando en círculo
// sin arrancar nunca (el bot se cuelga sin dar ningún error).
// La solución es importar handler.js dinámicamente, ya dentro del
// listener de mensajes, cuando el módulo ya terminó de cargar.

// -----------------------------------------------------------------------
// Administra varias sesiones de Baileys al mismo tiempo, cada una
// identificada por un sessionId (en la práctica, el número del usuario
// que escribió ".conectar"). Cada sesión tiene su propio auth guardado
// en Mongo (ver mongoAuthState.js) y su propio manejador de mensajes.
//
// Cada entrada guarda { sock, connected }: `connected` solo pasa a true
// cuando el evento 'open' se dispara (es decir, cuando el QR fue
// escaneado y la sesión quedó autenticada). Esto es clave para no
// confundir "existe un socket" con "está realmente conectado".
// -----------------------------------------------------------------------

const activeSessions = new Map() // sessionId -> { sock, connected }

// Solo cuenta como "activa" una sesión que llegó a autenticarse de verdad.
export function getActiveSessionIds() {
  return [...activeSessions.entries()]
    .filter(([, entry]) => entry.connected)
    .map(([sessionId]) => sessionId)
}

export function getSession(sessionId) {
  return activeSessions.get(sessionId)?.sock
}

export async function getOrCreateSession(sessionId, callbacks = {}) {
  const existing = activeSessions.get(sessionId)

  if (existing) {
    if (existing.connected) return existing.sock

    // Hay un socket pendiente para este sessionId (por ejemplo, uno que
    // restoreAllSessions creó sin onQR al arrancar el bot, o un intento
    // previo que nunca se conectó). Como ahora sí hay alguien esperando
    // un QR real, lo descartamos y arrancamos uno limpio con los
    // callbacks actuales — si no, el QR se generaría para un socket que
    // nadie está escuchando.
    try { existing.sock.end(new Error('Reemplazado por un nuevo intento de conexión')) } catch {}
    activeSessions.delete(sessionId)
  }

  return createSession(sessionId, callbacks)
}

async function createSession(sessionId, { onQR, onOpen } = {}) {
  const { state, saveCreds } = await useMongoAuthState(sessionId)
  const { version } = await fetchLatestWaWebVersion()

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: ['SOSI CODEX', 'Chrome', '1.0.0']
  })

  activeSessions.set(sessionId, { sock, connected: false })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && onQR) {
      try {
        const dataUrl = await QRCode.toDataURL(qr, { width: 300 })
        onQR(dataUrl)
      } catch (err) {
        console.error(`Error generando imagen QR para sesión ${sessionId}:`, err.message)
      }
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
      const loggedOut = statusCode === DisconnectReason.loggedOut
      const entry = activeSessions.get(sessionId)
      const yaEstuvoConectada = entry?.connected === true

      console.log(`❌ [Sesión ${sessionId}] Conexión cerrada. Código: ${statusCode}`)
      activeSessions.delete(sessionId)

      if (loggedOut) {
        console.log(`🔒 [Sesión ${sessionId}] Cerró sesión (logout). Borrando de Mongo para evitar reconexiones fantasma.`)
        const { clearMongoAuthState, unregisterSession } = await import('./mongoAuthState.js')
        await clearMongoAuthState(sessionId)
        await unregisterSession(sessionId)
      } else if (yaEstuvoConectada) {
        // Ya estaba autenticada (por ejemplo se cayó la red): reconectar
        // sola, sin pedir un QR nuevo.
        createSession(sessionId, { onQR, onOpen }).catch(err =>
          console.error(`Error reconectando sesión ${sessionId}:`, err)
        )
      } else {
        // Nunca llegó a conectarse (el QR expiró sin ser escaneado).
        // No reintentamos solos: dejamos que el usuario ejecute
        // .conectar de nuevo, tal como se le indicó. También la
        // desregistramos, para que restoreAllSessions no la vuelva a
        // intentar reconectar sola en cada reinicio (eso era lo que
        // generaba sesiones "fantasma" chocando con intentos reales).
        console.log(`⌛ [Sesión ${sessionId}] El QR expiró sin escanear. El usuario debe ejecutar .conectar de nuevo.`)
        const { clearMongoAuthState, unregisterSession } = await import('./mongoAuthState.js')
        await clearMongoAuthState(sessionId)
        await unregisterSession(sessionId)
      }
    } else if (connection === 'open') {
      const entry = activeSessions.get(sessionId)
      if (entry) entry.connected = true
      console.log(`✅ [Sesión ${sessionId}] conectada correctamente`)
      if (onOpen) onOpen()
    }
  })

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return
    const msg = m.messages[0]
    if (!msg?.message) return

    try {
      const { handler } = await import('./handler.js')
      await handler(sock, m)
    } catch (err) {
      console.error(`Error en handler de sesión ${sessionId}:`, err)
    }
  })

  return sock
}

// Se llama una vez al arrancar el bot principal, para reconectar
// automáticamente todas las sesiones de sub-usuarios que ya existían
// antes del reinicio (sin volver a pedirles el QR).
export async function restoreAllSessions(listRegisteredSessions) {
  const ids = await listRegisteredSessions()
  for (const id of ids) {
    getOrCreateSession(id).catch(err =>
      console.error(`Error restaurando sesión ${id}:`, err)
    )
  }
}