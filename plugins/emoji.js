const PACKS_EMOJI = {
  1: { nombre: 'Risas', emojis: ['😂', '🤣', '😹', '😆', '😅'] },
  2: { nombre: 'Amor', emojis: ['❤️', '💕', '💖', '😍', '🥰'] },
  3: { nombre: 'Fuego', emojis: ['🔥', '💯', '⚡', '🚀', '💪'] },
  4: { nombre: 'Sorpresa', emojis: ['😱', '😲', '🤯', '👀', '‼️'] },
  5: { nombre: 'Tristeza', emojis: ['😢', '😭', '💔', '😞', '🥺'] },
  6: { nombre: 'Aprobación', emojis: ['👍', '✅', '🙌', '👏', '💚'] }
}

function construirMenu() {
  let texto = `🎭〔 *MENÚ DE REACCIONES* 〕🎭\n━━━━━━━━━━━━━━━━━━━━\n\n`
  texto += `Responde a un mensaje con:\n*.emoji <número de pack> <cantidad>*\n\n`
  texto += `*Packs disponibles:*\n`
  for (const [num, pack] of Object.entries(PACKS_EMOJI)) {
    texto += `*${num}.* ${pack.nombre}  ${pack.emojis.join(' ')}\n`
  }
  texto += `\n*Ejemplo:* .emoji 3 20\n(Reacciona con el pack "Fuego", 20 veces)\n\n`
  texto += `⚠️ Nota: WhatsApp solo permite 1 reacción activa por vez, así que al final quedará fija la última del ciclo — el efecto se ve mientras se está enviando.\n━━━━━━━━━━━━━━━━━━━━`
  return texto
}

export default {
  command: ['emoji', 'reaccion', 'reaccionar', 'spamemoji'],
  description: 'Reacciona a un mensaje citado con un ciclo de emojis de un pack elegido',
  exec: async ({ sock, from, msg, args }) => {

    // 1. Verificar si el usuario está respondiendo a un mensaje
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo
    if (!quotedMsg || !quotedMsg.stanzaId) {
      return sock.sendMessage(
        from,
        { text: '❌ *Debes responder a un mensaje* para usar este comando.\n\n' + construirMenu() },
        { quoted: msg }
      )
    }

    // 2. Si no hay argumentos, mostrar el menú
    if (args.length < 1) {
      return sock.sendMessage(from, { text: construirMenu() }, { quoted: msg })
    }

    // 3. Validar que haya pack y cantidad
    if (args.length < 2) {
      return sock.sendMessage(
        from,
        { text: '❌ *Formato incorrecto*\n\nDebes indicar el número de pack y la cantidad.\n\n*Ejemplo:* .emoji 3 20\n\n' + construirMenu() },
        { quoted: msg }
      )
    }

    const numeroPack = parseInt(args[0])
    const cantidad = parseInt(args[1])

    const pack = PACKS_EMOJI[numeroPack]
    if (!pack) {
      return sock.sendMessage(
        from,
        { text: `❌ Ese pack no existe.\n\n${construirMenu()}` },
        { quoted: msg }
      )
    }

    if (isNaN(cantidad) || cantidad < 1) {
      return sock.sendMessage(from, { text: '⚠️ La cantidad mínima es 1.' }, { quoted: msg })
    }
    if (cantidad > 50) {
      return sock.sendMessage(from, { text: '⚠️ *Máximo 50* para evitar que WhatsApp bloquee al bot por spam.' }, { quoted: msg })
    }

    // 4. Configurar la clave del mensaje a reaccionar
    const targetKey = {
      remoteJid: from,
      fromMe: false,
      id: quotedMsg.stanzaId,
      participant: quotedMsg.participant
    }

    await sock.sendMessage(
      from,
      { text: `⏳ *Procesando...*\nCiclo de "${pack.nombre}" ${cantidad} veces. Esto tomará unos segundos.` },
      { quoted: msg }
    )

    // 5. Ciclo de reacciones alternando emojis del pack (efecto visual mientras dura)
    try {
      for (let i = 0; i < cantidad; i++) {
        const emojiActual = pack.emojis[i % pack.emojis.length]

        await sock.sendMessage(from, {
          react: {
            text: emojiActual,
            key: targetKey
          }
        })

        // ⏱️ Retraso entre cada reacción para no saturar la API de WhatsApp
        await new Promise(resolve => setTimeout(resolve, 800))
      }

      await sock.sendMessage(
        from,
        { text: `✅ *¡Listo!* Se completó el ciclo de "${pack.nombre}" (${cantidad} reacciones enviadas).` },
        { quoted: msg }
      )

    } catch (err) {
      console.error('Error al reaccionar:', err)
      await sock.sendMessage(
        from,
        { text: '❌ Ocurrió un error al enviar las reacciones. Es posible que WhatsApp haya bloqueado la acción por spam.' },
        { quoted: msg }
      )
    }
  }
}
