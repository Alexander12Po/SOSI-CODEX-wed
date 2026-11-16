import { downloadMediaMessage } from '@whiskeysockets/baileys'

export const vvCache = new Map()

export async function guardarViewOnce(m) {
  try {
    const inner =
      m.message?.viewOnceMessage?.message ||
      m.message?.viewOnceMessageV2?.message ||
      m.message?.viewOnceMessageV2Extension?.message
    if (!inner) return

    const buffer = await downloadMediaMessage(
      { key: m.key, message: inner }, 'buffer', {}
    )
    const type = Object.keys(inner)[0]
    vvCache.set(m.key.id, {
      buffer,
      type,
      mimetype: inner[type]?.mimetype,
      ptt: inner[type]?.ptt
    })
    setTimeout(() => vvCache.delete(m.key.id), 30 * 60 * 1000)
  } catch (e) {
    console.error('vvCache error:', e.message)
  }
}