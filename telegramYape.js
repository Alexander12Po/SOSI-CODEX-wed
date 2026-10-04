import { TelegramClient } from 'telegram/index.js'
import { StringSession } from 'telegram/sessions/index.js'
import { NewMessage } from 'telegram/events/index.js'

const BOT = 'seeker_databot'
let client = null
let cola = Promise.resolve()

async function getClient() {
  if (client && client.connected) return client
  client = new TelegramClient(
    new StringSession(process.env.TG_SESSION_YAPE),
    Number(process.env.TG_API_ID_YAPE || process.env.TG_API_ID),
    process.env.TG_API_HASH_YAPE || process.env.TG_API_HASH,
    { connectionRetries: 5 }
  )
  await client.connect()
  return client
}

// ✅ Filtrar mensajes no deseados (créditos, anti-spam, etc.)
function esMensajeNoDeseado(texto) {
  if (!texto) return true
  const t = texto.toLowerCase()
  const patrones = [
    'credit', 'descontaron', 'saldo', 'remaining', 'balance',
    '💳', '💎', 'restante', 'se descontaron',
    'anti-spam', 'intenta despues', 'intenta después',
    'wanted for', 'legend'
  ]
  for (const patron of patrones) {
    if (t.includes(patron)) return true
  }
  if (t.match(/restante[s]?\s*:\s*\d+/)) return true
  if (t.match(/remaining\s*:\s*\d+/)) return true
  const lineaTrim = texto.trim()
  if (lineaTrim.match(/^\d{5,}$/) && lineaTrim.length < 15) return true
  return false
}

// ✅ Limpieza de texto
function limpiarTexto(texto) {
  if (!texto) return ''
  let lineas = texto.split('\n')
  let lineasLimpias = []

  for (let linea of lineas) {
    const lineaTrim = linea.trim()
    if (esMensajeNoDeseado(lineaTrim)) continue
    
    // Personalizar encabezado si viene del bot
    if (linea.includes('SEEKER') || linea.includes('seeker')) {
      lineasLimpias.push('[★SOSI_CODEX] → YAPE / PLIN [PREMIUM]')
    } else {
      lineasLimpias.push(linea)
    }
  }
  return lineasLimpias.join('\n').trim()
}

async function consultarInterno(comando) {
  const tg = await getClient()
  const entidad = await tg.getEntity(BOT)
  const chatId = entidad.id

  const mensajes = []
  let ultimo = Date.now()
  let timeoutId = null

  const respuestaPromise = new Promise((resolve) => {
    const handler = (evento) => {
      const msgText = evento.message.text || evento.message.message || ''
      if (!esMensajeNoDeseado(msgText)) {
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

export function consultarYape(comando) {
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