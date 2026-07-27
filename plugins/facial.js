import axios from 'axios'
import FormData from 'form-data'
import { downloadMediaMessage } from '@whiskeysockets/baileys'

export default {
  command: ['facial'],
  description: 'Reconocimiento facial - Busca coincidencias por foto',
  exec: async ({ sock, from, msg, args }) => {
    // Verificar si hay imagen en el mensaje citado o directo
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const quoted = contextInfo?.quotedMessage
    const imageMessage = quoted?.imageMessage || msg.message?.imageMessage

    if (!imageMessage) {
      await sock.sendMessage(
        from,
        { 
          text: '❌ Debes enviar o citar una imagen.\n\n*Uso correcto:*\n- Envía una foto con el comando: *.facial*\n- O cita una foto existente: *.facial* (respondiendo a la imagen)' 
        },
        { quoted: msg }
      )
      return false
    }

    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔍 Analizando rostro en la imagen...' }, { quoted: msg })

      // Reconstruimos la key correcta según si la imagen viene citada o directa
      const targetMessage = quoted
        ? {
            key: {
              remoteJid: from,
              id: contextInfo?.stanzaId || msg.key.id,
              participant: contextInfo?.participant
            },
            message: quoted
          }
        : { key: msg.key, message: msg.message }

      // Descargar la imagen usando la función correcta de Baileys
      const imageBuffer = await downloadMediaMessage(
        targetMessage,
        'buffer',
        {},
        { 
          logger: console,
          reuploadRequest: sock.updateMediaMessage
        }
      )

      // Crear FormData para enviar la imagen
      const formData = new FormData()
      formData.append('image_facial', imageBuffer, {
        filename: 'facial.jpg',
        contentType: 'image/jpeg'
      })

      // Petición a la API con FormData
      const { data: response } = await axios.post(
        'https://api-codart.cgrt.org/api/v1/consultas/fd/facial/top',
        formData,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            ...formData.getHeaders()
          }
        }
      )

      // Verificar si la consulta fue exitosa
      if (!response.success || !response.data || response.data.coincidencias_encontradas === 0) {
        await sock.sendMessage(
          from,
          { text: '❌ No se encontraron coincidencias faciales en la base de datos.' },
          { quoted: msg }
        )
        return false
      }

      // Construcción del mensaje con TODOS los datos
      let resultado = `─❐ *RECONOCIMIENTO FACIAL* ❐\n`
      resultado += `│\n`
      resultado += `🎯 *Tipo:* ${response.data.tipo_resultado || 'Rostro'}\n`
      resultado += ` *Coincidencias:* ${response.data.coincidencias_mostradas}\n`
      resultado += `│\n`
      
      response.data.coincidencias.forEach((item, index) => {
        let emoji = '🔴'
        if (item.porcentaje >= 90) emoji = '🟢'
        else if (item.porcentaje >= 75) emoji = '🟡'
        
        resultado += `─ *${index + 1}.* ${emoji} *${item.nombre || 'DESCONOCIDO'}*\n`
        resultado += `│  🆔 DNI: ${item.dni || 'N/A'}\n`
        resultado += `│  📈 Coincidencia: ${item.porcentaje}%\n`
        resultado += `│\n`
      })
      
      resultado += `└────────────`

      await sock.sendMessage(from, { text: resultado }, { quoted: msg })

    } catch (err) {
      console.error('Error en reconocimiento facial:', err?.response?.data || err.message)
      await sock.sendMessage(
        from,
        { text: '❌ Ocurrió un error al procesar la imagen. Verifica que sea una foto clara de rostro.' },
        { quoted: msg }
      )
      return false
    }
  }
}
