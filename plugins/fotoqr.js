import { downloadMediaMessage } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'

// catbox.moe permite subir archivos públicamente sin necesitar API key.
// Devuelve una URL directa a la imagen que cualquiera puede abrir.
async function uploadToCatbox(buffer, filename) {
  const form = new FormData()
  form.append('reqtype', 'fileupload')
  form.append('fileToUpload', new Blob([buffer]), filename)

  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form
  })

  if (!res.ok) {
    throw new Error(`Catbox respondió con estado ${res.status}`)
  }

  const url = (await res.text()).trim()

  if (!url.startsWith('http')) {
    throw new Error(`Respuesta inesperada de catbox: ${url}`)
  }

  return url
}

export default {
  command: ['fotoqr', 'qrfoto'],
  description: 'Convierte una foto en un código QR que lleva a esa foto',
  exec: async ({ sock, from, msg }) => {
    const directImage = msg.message?.imageMessage
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const quotedImage = quoted?.imageMessage

    if (!directImage && !quotedImage) {
      return sock.sendMessage(
        from,
        { text: '❌ *Error:* Envía una foto con el comando *.fotoqr* en el texto, o responde a una foto con *.fotoqr*' },
        { quoted: msg }
      )
    }

    try {
      await sock.sendMessage(from, { text: '⏳ *Subiendo foto y generando QR...*' }, { quoted: msg })

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

      const imageBuffer = await downloadMediaMessage(targetMessage, 'buffer', {})

      // 1. Subir la foto para tener una URL pública a la que el QR pueda apuntar
      const publicUrl = await uploadToCatbox(imageBuffer, `foto_${Date.now()}.jpg`)

      // 2. Generar el QR que apunta a esa URL
      const qrBuffer = await QRCode.toBuffer(publicUrl, {
        type: 'png',
        width: 512,
        margin: 2
      })

      return sock.sendMessage(
        from,
        {
          image: qrBuffer,
          caption: `✅ *QR generado*\n\nEscanéalo para ver la foto:\n${publicUrl}`
        },
        { quoted: msg }
      )
    } catch (err) {
      console.error('Error en comando fotoqr.js:', err)
      return sock.sendMessage(
        from,
        { text: '❌ *Error:* No se pudo generar el QR. Intenta de nuevo.' },
        { quoted: msg }
      )
    }
  }
}
