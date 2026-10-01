import { consultarTelegram, enviarResultadoWhatsApp } from '../telegram.js'

export default {
  command: ['nm', 'nombre'], // Puedes usar .nm o .nombre
  cost: 0,
  exec: async ({ sock, msg, from, args }) => {
    const valor = args.join(' ').trim()
    
    // ✅ Validación con formato profesional
    if (!valor) {
      await sock.sendMessage(from, { 
        text: '⚠️ *Formato incorrecto*\n\nUsa el comando de la siguiente manera:\n👉 *.nm <nombre y apellido>*' 
      }, { quoted: msg })
      return false
    }
    
    // 👇 Ajusta este comando si tu bot de Telegram usa otro (ej: /nombre en vez de /nm)
    const comandoTelegram = `/nm ${valor}`
    
    // ✅ Mensaje de carga profesional
    await sock.sendMessage(from, { 
      text: `🛡️ *SOSI CODEX* | Buscando registros de *${valor}*...\n⏳ Por favor, espere un momento.` 
    }, { quoted: msg })
    
    let salida
    try {
      salida = await consultarTelegram(comandoTelegram)
    } catch (err) {
      console.error('Error consultando, verifique su conexión (nm):', err)
      // ✅ Mensaje de error profesional
      await sock.sendMessage(from, { 
        text: '❌ *Error de conexión*\n\nNo se pudo comunicar con el servicio. Por favor, intenta de nuevo en unos momentos.' 
      }, { quoted: msg })
      return false
    }
    
    // ✅ Mensaje de sin resultados profesional
    if (!salida.length) {
      await sock.sendMessage(from, { 
        text: `⚠️ *Sin resultados*\n\nNo se encontró información para el nombre *${valor}*. Verifica que esté bien escrito o intenta con el nombre completo.` 
      }, { quoted: msg })
      return false
    }
    
    // Envía el resultado limpio a WhatsApp
    await enviarResultadoWhatsApp(sock, from, salida)
  }
}
