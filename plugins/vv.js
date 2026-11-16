import { vvCache } from '../vvCache.js'

export default {
  command: ['vv', 'viewonce'],
  description: 'Descarga fotos, videos y audios enviados para ver una sola vez',
  exec: async ({ sock, from, msg }) => {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const quotedId = contextInfo?.stanzaId

    if (!contextInfo?.quotedMessage || !quotedId) {
      return sock.sendMessage(
        from,
        { text: '❌ *Error:* Responde a una foto, video o audio de "una sola vez" con el comando *.vv*' },
        { quoted: msg }
      )
    }

    const cached = vvCache.get(quotedId)

    if (!cached) {
      return sock.sendMessage(
        from,
        { text: '❌ *No tengo guardado ese archivo.* Solo puedo recuperar los que llegaron después de activar esta función y hace menos de 30 min.' },
        { quoted: msg }
      )
    }

    try {
      const { buffer, type, mimetype, ptt } = cached

      if (type === 'imageMessage') {
        return await sock.sendMessage(
          from,
          { image: buffer, caption: '🔓 *Foto desbloqueada con éxito*' },
          { quoted: msg }
        )
      }

      if (type === 'videoMessage') {
        return await sock.sendMessage(
          from,
          { video: buffer, caption: '🔓 *Video desbloqueado con éxito*' },
          { quoted: msg }
        )
      }

      if (type === 'audioMessage') {
        await sock.sendMessage(
          from,
          { text: '🔓 *Audio desbloqueado con éxito*' },
          { quoted: msg }
        )
        return await sock.sendMessage(from, {
          audio: buffer,
          mimetype: mimetype || 'audio/ogg; codecs=opus',
          ptt
        })
      }
    } catch (err) {
      console.error('Error en comando vv.js:', err)
      return sock.sendMessage(
        from,
        { text: '❌ *Error:* No se pudo reenviar el archivo.' },
        { quoted: msg }
      )
    }
  }
}
