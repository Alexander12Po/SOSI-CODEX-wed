import { consultarTelegram, enviarResultadoWhatsApp } from '../telegram.js'

export default {
  command: ['nm', 'nombre'],
  cost: 0,
  exec: async ({ sock, msg, from, args }) => {
    const valor = args.join(' ').trim()

    if (!valor) {
      await sock.sendMessage(from, { 
        text: '⚠️ *Formato incorrecto*\n\nUsa el comando así:\n */nm <nombre completo>*' 
      }, { quoted: msg })
      return false
    }

    const comandoTelegram = `/nm ${valor}`

    // ✅ Enviar mensaje de carga y GUARDAR el key para eliminarlo después
    const msgCarga = await sock.sendMessage(from, { 
      text: `🛡️ *SOSI CODEX* | Buscando registros de *${valor}*...\n Por favor, espere un momento.` 
    }, { quoted: msg })

    let salida
    try {
      salida = await consultarTelegram(comandoTelegram)
    } catch (err) {
      console.error('Error consultando, verifique su conexión (nm):', err)
      // ✅ Eliminar mensaje de carga si hay error
      if (msgCarga?.key) {
        await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
      }
      await sock.sendMessage(from, { 
        text: '❌ *Error de conexión*\n\nNo se pudo comunicar con el servicio. Intenta de nuevo en un momento.' 
      }, { quoted: msg })
      return false
    }

    if (!salida.length) {
      // ✅ Eliminar mensaje de carga si no hay resultados
      if (msgCarga?.key) {
        await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
      }
      await sock.sendMessage(from, { 
        text: `⚠️ *Sin resultados*\n\nNo se encontró información para *${valor}*. Verifica que esté bien escrito o intenta con el nombre completo.` 
      }, { quoted: msg })
      return false
    }

    // ✅ ELIMINAR mensaje de carga antes de enviar el resultado
    if (msgCarga?.key) {
      await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
    }

    // Enviar el resultado limpio
    await enviarResultadoWhatsApp(sock, from, salida)
  }
}