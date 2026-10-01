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

// ✅ Función para limpiar texto y filtrar mensajes no deseados
function limpiarTextoTelegram(texto) {
  if (!texto) return ''
  
  let lineas = texto.split('\n')
  let lineasLimpias = []
  
  for (let linea of lineas) {
    const lineaTrim = linea.trim()
    
    // 1. Eliminar líneas de créditos
    if (lineaTrim.includes('crédito') || lineaTrim.includes('credito') || 
        lineaTrim.includes('Créditos restantes') || lineaTrim.includes('Creditos restantes') ||
        lineaTrim.includes('Se descontaron')) {
      continue
    }
    
    // 2. Eliminar "Wanted for" y "LEGEND"
    if (lineaTrim.includes('Wanted for') || lineaTrim.includes('LEGEND')) {
      continue
    }
    
    // 3. Eliminar mensajes de anti-spam
    if (lineaTrim.includes('ANTI-SPAM') || lineaTrim.includes('INTENTA DESPUES')) {
      continue
    }
    
    // 4. Reemplazar encabezado de LEDERDATA por SOSI_CODEX
    if (linea.includes('LEDERDATA.NET')) {
      lineasLimpias.push('[★SOSI_CODEX] → RENIEC ONLINE [PREMIUM]')
    } else {
      lineasLimpias.push(linea)
    }
  }
  
  return lineasLimpias.join('\n').trim()
}

// ✅ Detectar si un mensaje es de créditos o anti-spam
function esMensajeNoDeseado(texto) {
  if (!texto) return true
  const textoLower = texto.toLowerCase()
  
  if (textoLower.includes('crédito') || textoLower.includes('credito') ||
      textoLower.includes('créditos restantes') || textoLower.includes('creditos restantes') ||
      textoLower.includes('se descontaron')) {
    return true
  }
  
  if (textoLower.includes('anti-spam') || textoLower.includes('intenta despues')) {
    return true
  }
  
  return false
}

async function consultarInterno(comando) {
  const tg = await getClient()
  
  const entidad = await tg.getEntity(BOT)
  const chatId = entidad.id // ✅ Solo el ID numérico
  
  const mensajes = []
  let ultimo = Date.now()
  let timeoutId = null
  
  // ✅ Usar Promises en lugar de while(true) para no bloquear WhatsApp
  const respuestaPromise = new Promise((resolve) => {
    const handler = (evento) => {
      const msgText = evento.message.text || evento.message.message || ''
      
      // ✅ Filtrar mensajes no deseados
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
    const item = { texto: limpiarTextoTelegram(m.text || m.message || '') }
    
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
      await sock.sendMessage(from, { 
        image: item.buffer, 
        caption: item.texto || undefined 
      })
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