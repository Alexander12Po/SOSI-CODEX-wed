import axios from 'axios'

export default {
  command: ['ia', 'ai', 'chatbot'],
  cost: 0,
  exec: async ({ sock, msg, from, args }) => {
    const texto = args.join(' ').trim()
    
    // Si el usuario no escribe nada, mostrar instrucciones
    if (!texto) {
      await sock.sendMessage(from, { 
        text: '🤖 *SOSI CODEX | INTELIGENCIA ARTIFICIAL*\n\nHola, soy tu asistente virtual potenciado por Xrahat AI.\n\n💡 *Cómo usarme:*\n*.ia <tu pregunta o petición>*\n\n📌 *Ejemplos:*\n*.ia ¿Cómo se hace una torta?*\n*.ia Escribe un poema sobre la tecnología*\n*.ia Resume el texto que te envíe arriba*' 
      }, { quoted: msg })
      return false
    }

    // Mostrar estado de "escribiendo..." en WhatsApp para mejor experiencia
    await sock.sendPresenceUpdate('composing', from)

    try {
      // Usamos el número del usuario como UID. 
      // Esto es CLAVE: hace que la IA recuerde la conversación de CADA persona por separado.
      const userId = (msg.sender || msg.key.participant || from).replace(/[^0-9]/g, '')
      
      // Codificamos el texto para evitar errores con caracteres especiales, emojis o espacios
      const url = `https://xrahat-worm-ai.vercel.app/api/chat?text=${encodeURIComponent(texto)}&uid=${userId}&stream=0`
      
      // Timeout de 30 segundos por si la IA tarda en responder
      const response = await axios.get(url, { timeout: 30000 })
      const data = response.data

      // Verificar que la respuesta sea exitosa
      if (data && data.success && data.reply) {
        await sock.sendMessage(from, { 
          text: `🧠 *Xrahat AI*\n\n${data.reply}\n\n━━━━━━━━━━━━━━━━━━\n⚡ _Modelo: ${data.model || 'Xrahat-Ai'}_` 
        }, { quoted: msg })
      } else {
        throw new Error('La API no devolvió una respuesta válida')
      }
    } catch (error) {
      console.error('❌ Error en comando IA:', error.message)
      await sock.sendMessage(from, { 
        text: '❌ *Error de IA*\n\nNo pude procesar tu solicitud en este momento. El servicio puede estar saturado o la pregunta es muy compleja.\n\nIntenta de nuevo en unos segundos.' 
      }, { quoted: msg })
    } finally {
      // Quitar el estado de "escribiendo..."
      await sock.sendPresenceUpdate('paused', from)
    }
  }
}