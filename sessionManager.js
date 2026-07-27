import {
  makeWASocket,
  fetchLatestWaWebVersion,
  DisconnectReason
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import QRCode from 'qrcode'
import { useMongoAuthState } from './mongoAuthState.js'
import { handler } from './handler.js'

// -----------------------------------------------------------------------
// Administra varias sesiones de Baileys al mismo tiempo, cada una
// identificada por un sessionId (en la práctica, el número del usuario
// que escribió ".conectar"). Cada sesión tiene su propio auth guardado
// en Mongo (ver mongoAuthState.js) y su propio manejador de mensajes.
// -----------------------------------------------------------------------

const activeSessions = new Map() // sessionId -> sock

export function getActiveSessionIds() {
  return [...activeSessions.keys()]
}

export function getSession(sessionId) {
  return activeSessions.get(sessionId)
}

export async function getOrCreateSession(sessionId, callbacks = {}) {
  if (activeSessions.has(sessionId)) return activeSessions.get(sessionId)
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

  activeSessions.set(sessionId, sock)

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
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      console.log(`❌ [Sesión ${sessionId}] Conexión cerrada. Código: ${statusCode}`)
      activeSessions.delete(sessionId)

      if (shouldReconnect) {
        createSession(sessionId, { onQR, onOpen }).catch(err =>
          console.error(`Error reconectando sesión ${sessionId}:`, err)
        )
      } else {
        console.log(`🔒 [Sesión ${sessionId}] Cerró sesión (logout). No se reconecta.`)
      }
    } else if (connection === 'open') {
      console.log(`✅ [Sesión ${sessionId}] conectada correctamente`)
      if (onOpen) onOpen()
    }
  })

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return
    const msg = m.messages[0]
    if (!msg?.message) return

    try {
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