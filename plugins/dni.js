import { consultarTelegram, enviarResultadoWhatsApp } from '../telegram.js'

export default {
  command: ['dni'],
  cost: 0,
  exec: async ({ sock, msg, from, args }) => {
    const valor = args.join(' ').trim()
    
    // ✅ Validación con formato profesional
    if (!valor) {
      await sock.sendMessage(from, { 
        text: '⚠️ *Formato incorrecto*\n\nUsa el comando de la siguiente manera:\n👉 *.dni <número>*' 
      }, { quoted: msg })
      return false
    }
    
    const comandoTelegram = `/dni ${valor}`
    
    // ✅ Mensaje de carga profesional y elegante
    await sock.sendMessage(from, { 
      text: `🛡️ *SOSI CODEX* | Consultando registros de *${valor}*...\n⏳ Por favor, espere un momento.` 
    }, { quoted: msg })
    
    let salida
    try {
      salida = await consultarTelegram(comandoTelegram)
    } catch (err) {
      console.error('Error consultando, verifique su conexión (dni):', err)
      // ✅ Mensaje de error profesional
      await sock.sendMessage(from, { 
        text: '❌ *Error de conexión*\n\nNo se pudo comunicar con el servicio. Por favor, intenta de nuevo en unos momentos.' 
      }, { quoted: msg })
      return false
    }
    
    // ✅ Mensaje de sin resultados profesional
    if (!salida.length) {
      await sock.sendMessage(from, { 
        text: `⚠️ *Sin resultados*\n\nNo se encontró información para el DNI *${valor}*. Verifica que el número sea correcto o intenta más tarde.` 
      }, { quoted: msg })
      return false
    }
    
    // Envía el resultado limpio (gracias a la función en telegram.js)
    await enviarResultadoWhatsApp(sock, from, salida)
  }
}