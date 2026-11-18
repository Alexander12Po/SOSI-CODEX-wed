import { TelegramClient } from 'telegram/index.js'
import { StringSession } from 'telegram/sessions/index.js'
import { NewMessage } from 'telegram/events/index.js'

const BOT = 'leder_data_og_bot'
let client = null
let cola = Promise.resolve()

async function getClient() {
  if (client && client.connected) return client
  client = new TelegramClient(
    new StringSession(process.env.TG_SESSION),
    Number(process.env.TG_API_ID),
    process.env.TG_API_HASH,
    { connectionRetries: 5 }
  )
  await client.connect()
  return client
}

function esMensajeDeCreditos(texto) {
  // CORREGIDO: Un texto vacío (ej: foto sin descripción) NO es un mensaje de créditos
  if (!texto || texto.trim() === '') return false 
  
  const t = texto.toLowerCase()
  const patrones = ['credit', 'descontaron', 'saldo', 'remaining', 'balance', '💳', '💎', 'restante', 'se descontaron']
  for (const patron of patrones) {
    if (t.includes(patron)) return true
  }
  
  // ELIMINADO: La regla que borraba números sueltos (como un DNI de 8 dígitos)
  return false
}

function esMensajeAntiSpam(texto) {
  if (!texto) return false
  const t = texto.toLowerCase()
  return t.includes('anti-spam') || t.includes('intenta despues') || t.includes('intenta después')
}

function limpiarTexto(texto) {
  if (!texto) return ''
  let lineas = texto.split('\n')
  let lineasLimpias = []
  for (let linea of lineas) {
    const lineaTrim = linea.trim()
    const lineaLower = lineaTrim.toLowerCase()
    if (esMensajeDeCreditos(lineaTrim)) continue
    if (lineaLower.includes('wanted for') || lineaLower.includes('legend')) continue
    if (esMensajeAntiSpam(lineaTrim)) {
      const match = lineaTrim.match(/(\d+)\s*segundos/i)
      const segundos = match ? match[1] : '90'
      lineasLimpias.push(`╭══════════════════════╮`)
      lineasLimpias.push(`│ ⏳ *SOSI CODEX* | ANTI-SPAM │`)
      lineasLimpias.push(`╰══════════════════════╯`)
      lineasLimpias.push(``)
      lineasLimpias.push(`⚠️ Has excedido el límite de consultas.`)
      lineasLimpias.push(`Por favor, espera *${segundos} segundos* antes de intentar nuevamente.`)
      lineasLimpias.push(``)
      lineasLimpias.push(`━━━━━━━━━━━━━━━━━━`)
      lineasLimpias.push(`💡 Este es un límite del servicio para evitar abusos.`)
      continue
    }
    if (linea.includes('LEDERDATA.NET')) {
      lineasLimpias.push('[★SOSI_CODEX] → RENIEC ONLINE [PREMIUM]')
    } else {
      lineasLimpias.push(linea)
    }
  }
  return lineasLimpias.join('\n').trim()
}

async function consultarInterno(comando) {
  try {
    console.log(`🔍 [TG] Iniciando consulta: "${comando}"`)
    const tg = await getClient()
    const entidad = await tg.getEntity(BOT)
    const chatId = entidad.id
    
    const mensajes = []
    let timeoutId = null

    const respuestaPromise = new Promise((resolve) => {
      const handler = (evento) => {
        const msgText = evento.message.text || evento.message.message || ''
        // Detectar si el mensaje tiene imagen o archivo adjunto
        const tieneMedia = !!(evento.message.photo || evento.message.document)

        // 🛡️ REGLA DE ORO: Si tiene imagen/documento, se guarda SIEMPRE. 
        // Si es solo texto, se guarda solo si NO es mensaje de créditos.
        if (tieneMedia || !esMensajeDeCreditos(msgText)) {
          mensajes.push(evento.message)
        }

        if (timeoutId) clearTimeout(timeoutId)
        // Esperar 2.5 segundos después del último mensaje recibido para asegurar que llegó todo
        timeoutId = setTimeout(() => {
          tg.removeEventHandler(handler, filtro)
          resolve(mensajes)
        }, 2500)
      }

      const filtro = new NewMessage({ chats: [chatId], incoming: true })
      tg.addEventHandler(handler, filtro)

      // Timeout de seguridad global a 15 segundos (por si el bot de Telegram no responde)
      setTimeout(() => {
        tg.removeEventHandler(handler, filtro)
        resolve(mensajes)
      }, 15000)
    })

    await tg.sendMessage(chatId, { message: comando })
    const resultados = await respuestaPromise
    
    console.log(`✅ [TG] Mensajes válidos recopilados: ${resultados.length}`)

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
  } catch (error) {
    console.error('❌ [TG] Error grave en consultarInterno:', error)
    return [] // Retorna vacío para que WhatsApp muestre "Sin resultados" en lugar de colgarse
  }
}

export function consultarTelegram(comando) {
  const tarea = cola.then(() => consultarInterno(comando))
  cola = tarea.catch((err) => {
    console.error('❌ [TG] Error en la cola de Telegram:', err)
  })
  return tarea
}

export async function enviarResultadoWhatsApp(sock, from, salida) {
  if (!salida || salida.length === 0) {
    await sock.sendMessage(from, { 
      text: '⚠️ *Sin resultados*\n\nNo se encontró información. Verifica el número o intenta más tarde.' 
    })
    return
  }

  for (const item of salida) {
    try {
      if (item.tipo === 'imagen') {
        await sock.sendMessage(from, { image: item.buffer, caption: item.texto || undefined })
      } else if (item.tipo === 'documento') {
        await sock.sendMessage(from, {
          document: item.buffer,
          mimetype: item.mime || 'application/pdf',
          fileName: item.nombre || 'documento.pdf',
          caption: item.texto || undefined
        })
      } else if (item.texto && item.texto.trim() !== '') {
        await sock.sendMessage(from, { text: item.texto })
      }
    } catch (err) {
      console.error('❌ [WA] Error enviando mensaje a WhatsApp:', err)
    }
  }
}