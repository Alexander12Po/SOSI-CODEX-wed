function esMensajeDeCreditos(texto) {
  if (!texto || texto.trim() === '') return false // CORREGIDO: Texto vacío NO es crédito (puede ser una imagen sin descripción)
  
  const t = texto.toLowerCase()
  const patrones = ['credit', 'descontaron', 'saldo', 'remaining', 'balance', '💳', '💎', 'restante', 'se descontaron']
  
  for (const patron of patrones) {
    if (t.includes(patron)) return true
  }
  
  // ELIMINADO: La regla que borraba números sueltos (como un DNI de 8 dígitos)
  return false
}

async function consultarInterno(comando) {
  const tg = await getClient()
  // Usar el username directo es más estable en GramJS que el ID numérico para los filtros
  const chatId = BOT 
  
  const mensajes = []
  let ultimo = Date.now()
  let timeoutId = null

  const respuestaPromise = new Promise((resolve) => {
    const handler = (evento) => {
      const msgText = evento.message.text || evento.message.message || ''
      const tieneMedia = evento.message.photo || evento.message.document

      // 🛡️ REGLA DE ORO: Si el mensaje tiene imagen o documento, LO GUARDAMOS SIEMPRE.
      if (tieneMedia) {
        mensajes.push(evento.message)
      } else if (!esMensajeDeCreditos(msgText)) {
        // Si es solo texto, aplicamos el filtro de créditos
        mensajes.push(evento.message)
      }

      ultimo = Date.now()
      if (timeoutId) clearTimeout(timeoutId)
      
      // Esperamos 2.5 segundos después del último mensaje para asegurar que llegó todo
      timeoutId = setTimeout(() => {
        tg.removeEventHandler(handler, filtro)
        resolve(mensajes)
      }, 2500)
    }

    const filtro = new NewMessage({ chats: [chatId], incoming: true })
    tg.addEventHandler(handler, filtro)

    // Timeout de seguridad a 15 segundos por si el bot de Telegram tarda o no responde
    setTimeout(() => {
      tg.removeEventHandler(handler, filtro)
      resolve(mensajes)
    }, 15000)
  })

  // Enviamos el comando
  await tg.sendMessage(chatId, { message: comando })
  
  const resultados = await respuestaPromise
  const salida = []

  for (const m of resultados) {
    const item = { texto: limpiarTexto(m.text || m.message || '') }
    
    if (m.photo) {
      item.tipo = 'imagen'
      item.buffer = await tg.downloadMedia(m)
    } else if (m.document) {
      item.tipo = 'documento'
      item.buffer = await tg.downloadMedia(m)
      item.nombre = m.document.fileName || 'documento.pdf'
      item.mime = m.document.mimeType || 'application/pdf'
    }
    salida.push(item)
  }
  
  return salida
}