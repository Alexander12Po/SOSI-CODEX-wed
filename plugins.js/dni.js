import { consultarTelegram, enviarResultadoWhatsApp } from '../telegram.js'

export default {
  command: ['dni'],
  cost: 0,
  exec: async ({ sock, msg, from, args }) => {
    const valor = args.join(' ').trim()

    if (!valor) {
      await sock.sendMessage(from, { text: '⚠️ Usa el comando así: *.noticias <país o código>*.' }, { quoted: msg })
      return false
    }

    // 👇 Ajusta este formato si el bot de Telegram espera el valor distinto
    //    (ej. con tilde, con mayúscula, pegado al comando, etc.)
    const comandoTelegram = `/dni ${valor}`

    await sock.sendMessage(from, { text: `🕵️ Consultando dni de *${valor}*, espera un momento...` }, { quoted: msg })

    let salida
    try {
      salida = await consultarTelegram(comandoTelegram)
    } catch (err) {
      console.error('Error consultando, verifique su conexión (dni):', err)
      await sock.sendMessage(from, { text: '❌ No se pudo conectar con el servicio de sosi. Intenta de nuevo en un momento.' }, { quoted: msg })
      return false
    }

    if (!salida.length) {
      await sock.sendMessage(from, { text: `⚠️ No hubo respuesta para "${valor}". Revisa que esté bien escrito o intenta más tarde.` }, { quoted: msg })
      return false
    }

    await enviarResultadoWhatsApp(sock, from, salida)
  }
}
