import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { botConfig } from '../config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Cache en memoria de mensajes recientes ---
const cache = new Map()

const MAX_ENTRADAS = 1500                  // límite de mensajes guardados en memoria
const TIEMPO_VIDA_MS = 24 * 60 * 60 * 1000 // 24 horas

const TMP_DIR = path.join(__dirname, '..', 'tmp_antidelete')
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

function borrarArchivoSiExiste(filePath) {
  if (!filePath) return
  fs.unlink(filePath, () => {})
}

setInterval(() => {
  const ahora = Date.now()
  for (const [key, val] of cache.entries()) {
    if (ahora - val.timestamp > TIEMPO_VIDA_MS) {
      borrarArchivoSiExiste(val.mediaPath)
      cache.delete(key)
    }
  }
}, 10 * 60 * 1000)

const TIPOS_MEDIA = {
  audio: { tipoDescarga: 'audio', extension: 'ogg' },
  imagen: { tipoDescarga: 'image', extension: 'jpg' },
  video: { tipoDescarga: 'video', extension: 'mp4' },
  documento: { tipoDescarga: 'document', extension: 'bin' },
  sticker: { tipoDescarga: 'sticker', extension: 'webp' }
}

function extraerInfo(message) {
  if (!message) return null

  if (message.conversation) return { texto: message.conversation, tipo: 'texto' }
  if (message.extendedTextMessage?.text) return { texto: message.extendedTextMessage.text, tipo: 'texto' }

  if (message.imageMessage) return { texto: message.imageMessage.caption || '', tipo: 'imagen', mediaMessage: message.imageMessage }
  if (message.videoMessage) return { texto: message.videoMessage.caption || '', tipo: 'video', mediaMessage: message.videoMessage }
  if (message.documentMessage) return { texto: message.documentMessage.fileName || '(documento)', tipo: 'documento', mediaMessage: message.documentMessage, fileName: message.documentMessage.fileName }
  if (message.audioMessage) return { texto: message.audioMessage.ptt ? '(nota de voz)' : '(audio)', tipo: 'audio', mediaMessage: message.audioMessage }
  if (message.stickerMessage) return { texto: '(sticker)', tipo: 'sticker', mediaMessage: message.stickerMessage }

  return null
}

async function descargarMedia(mediaMessage, tipo, messageId) {
  try {
    const config = TIPOS_MEDIA[tipo]
    if (!config) return null

    if (!mediaMessage.mediaKey || mediaMessage.mediaKey.length === 0) {
      if (tipo === 'video') console.log('⚠️ Video sin mediaKey, no se puede cachear:', messageId)
      return null
    }

    // Timeout de seguridad: si la red está mala y la descarga se cuelga,
    // abortamos en vez de dejar el proceso colgado indefinidamente.
    const TIMEOUT_MS = 30000
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout descargando media (antidelete)')), TIMEOUT_MS)
    )

    const descargaPromise = (async () => {
      const stream = await downloadContentFromMessage(mediaMessage, config.tipoDescarga)
      let buffer = Buffer.from([])
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
      }
      return buffer
    })()

    const buffer = await Promise.race([descargaPromise, timeoutPromise])

    if (tipo === 'video') {
      console.log(`📹 Video descargado: ${messageId}, tamaño: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)
    }

    let extension = config.extension
    if (mediaMessage.mimetype) {
      if (mediaMessage.mimetype.includes('ogg')) extension = 'ogg'
      else if (mediaMessage.mimetype.includes('mp4')) extension = 'mp4'
      else if (mediaMessage.mimetype.includes('jpeg') || mediaMessage.mimetype.includes('jpg')) extension = 'jpg'
      else if (mediaMessage.mimetype.includes('png')) extension = 'png'
      else if (mediaMessage.mimetype.includes('webp')) extension = 'webp'
    }

    const filePath = path.join(TMP_DIR, `${messageId}.${extension}`)
    fs.writeFileSync(filePath, buffer)

    return filePath
  } catch (err) {
    if (!err.message?.includes('Cannot derive from empty media key')) {
      console.error(`Error descargando ${tipo} (antidelete):`, err.message)
    }
    return null
  }
}

export async function cachearMensaje(msg) {
  try {
    if (!msg?.message || !msg.key?.id) return
    if (msg.message.protocolMessage) return

    const info = extraerInfo(msg.message)
    if (!info) return

    const chatId = msg.key.remoteJid
    const senderId = msg.key.participantAlt || msg.key.participant || msg.key.remoteJid
    const senderName = msg.pushName || senderId?.split('@')[0]

    const key = `${chatId}_${msg.key.id}`

    const entrada = {
      texto: info.texto,
      tipo: info.tipo,
      senderId,
      senderName,
      chatId,
      timestamp: Date.now(),
      fileName: info.fileName
    }

    if (info.mediaMessage) {
      const filePath = await descargarMedia(info.mediaMessage, info.tipo, msg.key.id)
      if (filePath) {
        entrada.mediaPath = filePath
        entrada.mimetype = info.mediaMessage.mimetype
        entrada.ptt = info.mediaMessage.ptt || false
      }
    }

    cache.set(key, entrada)

    if (cache.size > MAX_ENTRADAS) {
      const primeraClave = cache.keys().next().value
      const primeraEntrada = cache.get(primeraClave)
      borrarArchivoSiExiste(primeraEntrada?.mediaPath)
      cache.delete(primeraClave)
    }
  } catch (err) {
    console.error('Error cacheando mensaje (antidelete):', err.message)
  }
}

export async function manejarMensajeEliminado(sock, msg) {
  try {
    const protocolMsg = msg.message?.protocolMessage
    if (!protocolMsg?.key?.id) return

    const chatId = msg.key.remoteJid
    const key = `${chatId}_${protocolMsg.key.id}`
    const original = cache.get(key)

    if (!original) return

    const eliminadoPorId = msg.key.participantAlt || msg.key.participant || msg.key.remoteJid
    const esMismaPersona = eliminadoPorId?.split('@')[0].split(':')[0] === original.senderId?.split('@')[0].split(':')[0]

    const esTextoPlano = original.tipo === 'texto'
    const tieneArchivo = original.mediaPath && fs.existsSync(original.mediaPath)

    const textoAviso = `🗑️〔 *${botConfig.botName} - CODEX-VIP* 〕🗑️
━━━━━━━━━━━━━━━━━━━━

⚠️ *Mensaje eliminado detectado*

👤 *Enviado por:* @${original.senderId.split('@')[0]}
🧹 *Eliminado por:* ${esMismaPersona ? 'el mismo remitente' : '@' + eliminadoPorId.split('@')[0]}
📦 *Tipo:* ${original.tipo}${esTextoPlano ? `\n\n💬 *Contenido:*\n${original.texto}` : ''}

━━━━━━━━━━━━━━━━━━━━`

    const mentions = [original.senderId]
    if (!esMismaPersona) mentions.push(eliminadoPorId)

    await sock.sendMessage(chatId, { text: textoAviso, mentions })

    if (tieneArchivo) {
      const buffer = fs.readFileSync(original.mediaPath)

      if (original.tipo === 'audio') {
        await sock.sendMessage(chatId, {
          audio: buffer,
          mimetype: original.mimetype || 'audio/ogg; codecs=opus',
          ptt: original.ptt
        })
      } else if (original.tipo === 'imagen') {
        await sock.sendMessage(chatId, {
          image: buffer,
          caption: original.texto || undefined,
          mimetype: original.mimetype
        })
      } else if (original.tipo === 'video') {
        await sock.sendMessage(chatId, {
          video: buffer,
          caption: original.texto || undefined,
          mimetype: original.mimetype
        })
      } else if (original.tipo === 'documento') {
        await sock.sendMessage(chatId, {
          document: buffer,
          fileName: original.fileName || 'archivo',
          mimetype: original.mimetype
        })
      } else if (original.tipo === 'sticker') {
        await sock.sendMessage(chatId, { sticker: buffer })
      }
    }

    borrarArchivoSiExiste(original.mediaPath)
    cache.delete(key)
  } catch (err) {
    console.error('Error en manejarMensajeEliminado (antidelete):', err.message)
  }
}
