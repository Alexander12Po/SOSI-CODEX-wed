import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const TEMPLATE_URL = "https://raw.githubusercontent.com/RIFKIror/Assest/refs/heads/main/img/d7331de88b5218609903db7f0d6c300c.jpg"
const CROP = { x: 44, y: 55, width: 600, height: 580, radius: 30 }

let cachedTemplate = null

function drawCover(ctx, img, x, y, width, height) {
  const scale = Math.max(width / img.width, height / img.height)
  const sw = width / scale
  const sh = height / scale
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height)
}

async function getTemplate() {
  if (!cachedTemplate) {
    cachedTemplate = await loadImage(TEMPLATE_URL)
  }
  return cachedTemplate
}

async function buildFramedImage(inputBuffer) {
  const template = await getTemplate()
  const userImage = await loadImage(inputBuffer)

  const canvas = createCanvas(template.width, template.height)
  const ctx = canvas.getContext('2d')

  ctx.drawImage(template, 0, 0)

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(CROP.x, CROP.y, CROP.width, CROP.height, CROP.radius)
  ctx.clip()
  drawCover(ctx, userImage, CROP.x, CROP.y, CROP.width, CROP.height)
  ctx.restore()

  return canvas.encode('png')
}

export default {
  command: ['iqc', 'marco'],
  description: 'Genera una foto con marco a partir de una imagen enviada o citada',
  exec: async ({ sock, from, msg }) => {
    // Acepta la imagen tanto si la mandas directo con el comando en el caption,
    // como si respondes (cita) una imagen ya enviada.
    const directImage = msg.message?.imageMessage
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const quotedImage = quoted?.imageMessage

    if (!directImage && !quotedImage) {
      return sock.sendMessage(
        from,
        { text: '❌ *Error:* Envía una foto con el comando *.iqc* en el texto, o responde a una foto con *.iqc*' },
        { quoted: msg }
      )
    }

    try {
      await sock.sendMessage(from, { text: '⏳ *Generando imagen...*' }, { quoted: msg })

      let targetMessage
      if (directImage) {
        targetMessage = msg
      } else {
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo
        targetMessage = {
          message: quoted,
          key: {
            remoteJid: from,
            id: contextInfo?.stanzaId || msg.key.id,
            participant: contextInfo?.participant
          }
        }
      }

      const inputBuffer = await downloadMediaMessage(targetMessage, 'buffer', {})
      const resultBuffer = await buildFramedImage(inputBuffer)

      return sock.sendMessage(
        from,
        { image: resultBuffer, caption: '✅ *Imagen generada con éxito*' },
        { quoted: msg }
      )
    } catch (err) {
      console.error('Error en comando iqc.js:', err)
      return sock.sendMessage(
        from,
        { text: '❌ *Error:* No se pudo generar la imagen. Intenta de nuevo.' },
        { quoted: msg }
      )
    }
  }
}
