import { consultarTelegram, enviarResultadoWhatsApp } from '../telegram.js'

const COMANDO_TELEGRAM = '/planeta'

export default {
  command: ['planeta'],
  cost: 0,
  exec: async ({ sock, msg, from }) => {
    await sock.sendMessage(from, { text: '🌍 Consultando, espera un momento...' }, { quoted: msg })

    let salida
    try {
      salida = await consultarTelegram(COMANDO_TELEGRAM)
    } catch (err) {
      console.error('Error consultando @noticiasbot (planeta):', err)
      await sock.sendMessage(from, { text: '❌ No se pudo conectar con el servicio. Intenta de nuevo en un momento.' }, { quoted: msg })
      return false
    }

    if (!salida.length) {
      await sock.sendMessage(from, { text: '⚠️ No hubo respuesta a tiempo. Intenta de nuevo más tarde.' }, { quoted: msg })
      return false
    }

    await enviarResultadoWhatsApp(sock, from, salida)
  }
}
