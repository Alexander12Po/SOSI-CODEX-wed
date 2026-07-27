import { getOrCreateSession, getActiveSessionIds } from '../sessionManager.js'
import { registerSession } from '../mongoAuthState.js'

const MAX_SESSIONS = 3

export default {
  command: ['conectar', 'vincular'],
  cost: 0,
  exec: async ({ sock, msg, from, sender }) => {
    const sessionId = sender.split('@')[0]
    const activeIds = getActiveSessionIds()

    if (activeIds.includes(sessionId)) {
      await sock.sendMessage(from, { text: '✅ Ya tienes una sesión conectada.' }, { quoted: msg })
      return
    }

    if (activeIds.length >= MAX_SESSIONS) {
      await sock.sendMessage(from, {
        text: `⚠️ Ya se alcanzó el límite de ${MAX_SESSIONS} sesiones conectadas al mismo tiempo. Pídele a alguien que se desconecte primero.`
      }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { text: '⏳ Generando tu código QR, espera un momento...' }, { quoted: msg })

    await registerSession(sessionId)

    await getOrCreateSession(sessionId, {
      onQR: async (dataUrl) => {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        await sock.sendMessage(from, {
          image: buffer,
          caption: '📲 Escanea este código con WhatsApp > Dispositivos vinculados. Expira en unos 20 segundos, si no alcanzas a escanear usa `.conectar` de nuevo.'
        }, { quoted: msg })
      },
      onOpen: async () => {
        await sock.sendMessage(from, { text: '✅ ¡Tu sesión quedó conectada correctamente! Ya puedes usar el bot desde tu propio número.' })
      }
    })
  }
}