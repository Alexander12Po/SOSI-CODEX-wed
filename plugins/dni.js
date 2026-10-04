import { consultarTelegram, enviarResultadoWhatsApp } from '../telegram.js'

export default {
  command: ['dni'],
  cost: 0,
  exec: async ({ sock, msg, from, args }) => {
    const valor = args.join(' ').trim()
    if (!valor) {
      await sock.sendMessage(from, { 
        text: '⚠️ *Formato incorrecto*\n\nUsa el comando así:\n *.dni <número>*' 
      }, { quoted: msg })
      return false
    }
    const comandoTelegram = `/dni ${valor}`
    const msgCarga = await sock.sendMessage(from, { 
      text: `🛡️ *SOSI CODEX* | Consultando registros de *${valor}*...\n⏳ Por favor, espere un momento.` 
    }, { quoted: msg })
    let salida
    try {
      salida = await consultarTelegram(comandoTelegram)
    } catch (err) {
      console.error('Error consultando (dni):', err)
      if (msgCarga?.key) await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
      await sock.sendMessage(from, { 
        text: '❌ *Error de conexión*\n\nNo se pudo comunicar con el servicio. Intenta de nuevo en un momento.' 
      }, { quoted: msg })
      return false
    }
    if (!salida.length) {
      if (msgCarga?.key) await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
      await sock.sendMessage(from, { 
        text: `⚠️ *Sin resultados*\n\nNo se encontró información para *${valor}*. Verifica el número o intenta más tarde.` 
      }, { quoted: msg })
      return false
    }
    if (msgCarga?.key) {
      await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
    }
    await enviarResultadoWhatsApp(sock, from, salida)
  }
}