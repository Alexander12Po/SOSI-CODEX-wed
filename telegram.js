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

// ✅ Filtro robusto de créditos
function esMensajeDeCreditos(texto) {
  if (!texto) return true
  const t = texto.toLowerCase()
  const patrones = ['credit', 'descontaron', 'saldo', 'remaining', 'balance', '💳', '💎', 'restante', 'se descontaron']
  for (const patron of patrones) {
    if (t.includes(patron)) return true
  }
  if (t.match(/restante[s]?\s*:\s*\d+/)) return true
  if (t.match(/remaining\s*:\s*\d+/)) return true
  const lineaTrim = texto.trim()
  if (lineaTrim.match(/^\d{5,}$/) && lineaTrim.length < 15) return true
  return false
}

// ✅ Filtro de ANTI-SPAM
function esMensajeAntiSpam(texto) {
  if (!texto) return false
  const t = texto.toLowerCase()
  return t.includes('anti-spam') || t.includes('intenta despues') || t.includes('intenta después')
}

// ✅ Limpieza de texto
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
  const tg = await getClient()
  const entidad = await tg.getEntity(BOT)
  const chatId = entidad.id // ✅ Solo el ID numérico

  const mensajes = []
  let ultimo = Date.now()
  let timeoutId = null

  // ✅ Usar Promises en lugar de while(true)
  const respuestaPromise = new Promise((resolve) => {
    const handler = (evento) => {
      const msgText = evento.message.text || evento.message.message || ''
      if (!esMensajeDeCreditos(msgText)) {
        mensajes.push(evento.message)
      }
      ultimo = Date.now()
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        tg.removeEventHandler(handler, filtro)
        resolve(mensajes)
      }, 2000)
    }
    const filtro = new NewMessage({ chats: [chatId], incoming: true })
    tg.addEventHandler(handler, filtro)
    setTimeout(() => {
      tg.removeEventHandler(handler, filtro)
      resolve(mensajes)
    }, 15000)
  })

  await tg.sendMessage(entidad, { message: comando })
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

export function consultarTelegram(comando) {
  const tarea = cola.then(() => consultarInterno(comando))
  cola = tarea.catch(() => {})
  return tarea
}

export async function enviarResultadoWhatsApp(sock, from, salida) {
  for (const item of salida) {
    if (item.tipo === 'imagen') {
      await sock.sendMessage(from, { image: item.buffer, caption: item.texto || undefined })
    } else if (item.tipo === 'documento') {
      await sock.sendMessage(from, {
        document: item.buffer,
        mimetype: item.mime || 'application/pdf',
        fileName: item.nombre || 'documento.pdf',
        caption: item.texto || undefined
      })
    } else if (item.texto) {
      await sock.sendMessage(from, { text: item.texto })
    }
  }
}
