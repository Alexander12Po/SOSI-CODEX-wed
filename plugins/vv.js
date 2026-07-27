import { downloadMediaMessage } from '@whiskeysockets/baileys'

export default {
  command: ['vv', 'viewonce'],
  description: 'Descarga fotos y videos enviados para ver una sola vez',
  exec: async ({ sock, from, msg }) => {
    // Buscar si el usuario está respondiendo a otro mensaje
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
      return sock.sendMessage(
        from, 
        { text: '❌ *Error:* Por favor, responde a una foto, video o audio de "una sola vez" con el comando *.vv*' }, 
        { quoted: msg }
      );
    }

    // Los mensajes de "una sola vez" en WhatsApp pueden venir de 2 formas distintas:
    // 1) Envueltos: viewOnceMessage / viewOnceMessageV2 / viewOnceMessageV2Extension
    // 2) Directos: una imageMessage/videoMessage/audioMessage normal con la bandera viewOnce: true
    const viewOnceMsg =
      quoted.viewOnceMessage?.message ||
      quoted.viewOnceMessageV2?.message ||
      quoted.viewOnceMessageV2Extension?.message ||
      (quoted.imageMessage?.viewOnce ? { imageMessage: quoted.imageMessage } : null) ||
      (quoted.videoMessage?.viewOnce ? { videoMessage: quoted.videoMessage } : null) ||
      (quoted.audioMessage?.viewOnce ? { audioMessage: quoted.audioMessage } : null);

    if (!viewOnceMsg) {
      return sock.sendMessage(
        from, 
        { text: '❌ *Error:* El mensaje al que respondiste no es de "una sola vez".' }, 
        { quoted: msg }
      );
    }

    // Identificar si lo que hay dentro es imagen, video o audio
    const isImage = !!viewOnceMsg.imageMessage;
    const isVideo = !!viewOnceMsg.videoMessage;
    const isAudio = !!viewOnceMsg.audioMessage;

    if (!isImage && !isVideo && !isAudio) {
      return sock.sendMessage(
        from, 
        { text: '❌ *Error:* Solo puedo desbloquear fotos, videos o audios.' }, 
        { quoted: msg }
      );
    }

    try {
      await sock.sendMessage(from, { text: '⏳ *Desbloqueando archivo...*' }, { quoted: msg });
      
      // Reconstruimos el mensaje para que Baileys sepa qué descargar
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const targetMessage = {
        message: viewOnceMsg,
        key: {
          remoteJid: from,
          id: contextInfo?.stanzaId || msg.key.id,
          participant: contextInfo?.participant
        }
      };

      // Descargamos el archivo (buffer)
      const buffer = await downloadMediaMessage(targetMessage, "buffer", {});
      
      // Enviamos el archivo de vuelta como multimedia normal
      if (isImage) {
        return sock.sendMessage(
          from, 
          { image: buffer, caption: '🔓 *Foto desbloqueada con éxito*' }, 
          { quoted: msg }
        );
      } else if (isVideo) {
        return sock.sendMessage(
          from, 
          { video: buffer, caption: '🔓 *Video desbloqueado con éxito*' }, 
          { quoted: msg }
        );
      } else if (isAudio) {
        await sock.sendMessage(
          from,
          { text: '🔓 *Audio desbloqueado con éxito*' },
          { quoted: msg }
        );
        return sock.sendMessage(
          from,
          {
            audio: buffer,
            mimetype: viewOnceMsg.audioMessage.mimetype || 'audio/ogg; codecs=opus',
            ptt: viewOnceMsg.audioMessage.ptt || false
          }
        );
      }

    } catch (err) {
      console.error("Error en comando vv.js:", err);
      return sock.sendMessage(
        from, 
        { text: "❌ *Error:* No se pudo descargar el archivo de una sola vez." }, 
        { quoted: msg }
      );
    }
  }
}
