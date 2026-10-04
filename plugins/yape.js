import { consultarYape, enviarResultadoWhatsApp } from '../telegramYape.js'

export default {
  command: ['yape'],
  cost: 0,
  exec: async ({ sock, msg, from, args }) => {
    const textoCompleto = args.join(' ').trim()

    if (!textoCompleto) {
      await sock.sendMessage(from, { 
        text: `⚠️ *Formato incorrecto*\n\nUsa el comando así:\n *.yape <monto>|<nombre>|<dígito>|<destino>*\n\n *Ejemplos:*\n• *.yape 100|MARIA|123|Yape*\n• *.yape 50|JUAN|456|Plin*` 
      }, { quoted: msg })
      return false
    }

    let partes
    if (textoCompleto.includes('|')) {
      partes = textoCompleto.split('|').map(s => s.trim())
    } else {
      partes = textoCompleto.split(/\s+/).slice(0, 4)
    }

    if (partes.length < 4) {
      await sock.sendMessage(from, { 
        text: `⚠️ *Faltan datos*\n\nNecesito 4 valores separados por *|*:\n\n👉 *.yape <monto>|<nombre>|<dígito>|<destino>*\n\n📝 *Ejemplo:*\n*.yape 100|MARIA|123|Yape*` 
      }, { quoted: msg })
      return false
    }

    const [monto, nombre, digito, destino] = partes

    if (isNaN(monto) || Number(monto) <= 0) {
      await sock.sendMessage(from, { 
        text: '⚠️ *Monto inválido*\n\nEl monto debe ser un número mayor a 0.\n\n📝 Ejemplo: *.yape 100|MARIA|123|Yape*' 
      }, { quoted: msg })
      return false
    }

    const destinoValido = ['yape', 'plin'].includes(destino.toLowerCase())
    if (!destinoValido) {
      await sock.sendMessage(from, { 
        text: '⚠️ *Destino inválido*\n\nEl destino debe ser *Yape* o *Plin*.\n\n📝 Ejemplo: *.yape 100|MARIA|123|Yape*' 
      }, { quoted: msg })
      return false
    }

    const comandoTelegram = `/yape ${monto}|${nombre}|${digito}|${destino}`

    const msgCarga = await sock.sendMessage(from, { 
      text: `🛡️ *SOSI CODEX* | Procesando pago de *S/ ${monto}* a *${nombre}*...\n⏳ Por favor, espere un momento.` 
    }, { quoted: msg })

    let salida
    try {
      salida = await consultarYape(comandoTelegram)
    } catch (err) {
      console.error('Error consultando (yape):', err)
      if (msgCarga?.key) await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
      await sock.sendMessage(from, { 
        text: '❌ *Error de conexión*\n\nNo se pudo comunicar con el servicio. Intenta de nuevo en un momento.' 
      }, { quoted: msg })
      return false
    }

    if (!salida.length) {
      if (msgCarga?.key) await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
      await sock.sendMessage(from, { 
        text: `⚠️ *Sin resultados*\n\nNo se pudo procesar el pago para *${nombre}*. Verifica los datos o intenta más tarde.` 
      }, { quoted: msg })
      return false
    }

    if (msgCarga?.key) {
      await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
    }

    await enviarResultadoWhatsApp(sock, from, salida)
  }
}