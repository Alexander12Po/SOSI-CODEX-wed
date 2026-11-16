import { downloadMediaMessage } from '@whiskeysockets/baileys'

// Guarda en memoria los archivos "ver una sola vez" apenas llegan,
// porque después WhatsApp borra la URL y la clave para descargarlos.
export const vvCache = new Map()

const TTL_MS = 30 * 60 * 1000 // 30 minutos
const MAX_ITEMS = 50
const DEBUG = true // pon false cuando ya funcione

function desenvolver(message) {
  if (!message) return null
  // ephemeralMessage / documentWithCaptionMessage envuelven mensajes
  const base =
    message.ephemeralMessage?.message ||
    message.deviceSentMessage?.message ||
    message
  return (
    base.viewOnceMessage?.message ||
    base.viewOnceMessageV2?.message ||
    base.viewOnceMessageV2Extension?.message ||
    (base.imageMessage?.viewOnce ? { imageMessage: base.imageMessage } : null) ||
    (base.videoMessage?.viewOnce ? { videoMessage: base.videoMessage } : null) ||
    (base.audioMessage?.viewOnce ? { audioMessage: base.audioMessage } : null)
  )
}

export async function guardarViewOnce(msg) {
  try {
    if (DEBUG && msg?.message) {
      console.log('📩 llegó:', Object.keys(msg.message), '| id:', msg.key?.id)
    }

    const inner = desenvolver(msg?.message)
    if (!inner) return

    const type = Object.keys(inner).find((k) =>
      ['imageMessage', 'videoMessage', 'audioMessage'].includes(k)
    )
    if (!type) {
      if (DEBUG) console.log('⚠️ view-once sin imagen/video/audio:', Object.keys(inner))
      return
    }

    if (DEBUG) console.log(`🔎 view-once detectado (${type}), descargando...`)

    const buffer = await downloadMediaMessage(
      { key: msg.key, message: inner },
      'buffer',
      {}
    )

    if (vvCache.size >= MAX_ITEMS) {
      vvCache.delete(vvCache.keys().next().value)
    }

    vvCache.set(msg.key.id, {
      buffer,
      type,
      mimetype: inner[type]?.mimetype,
      ptt: inner[type]?.ptt || false,
      caption: inner[type]?.caption || ''
    })

    setTimeout(() => vvCache.delete(msg.key.id), TTL_MS)
    console.log(`🔒 View-once guardado (${type}) id: ${msg.key.id}`)
  } catch (err) {
    console.error('❌ vvCache error:', err.message)
  }
}
