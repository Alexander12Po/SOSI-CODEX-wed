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

// ✅ FUNCIÓN PARA LIMPIAR Y PERSONALIZAR EL TEXTO
function limpiarTextoTelegram(texto) {
  if (!texto) return ''
  
  let lineas = texto.split('\n')
  let lineasLimpias = []
  
  for (let linea of lineas) {
    const lineaTrim = linea.trim()
    
    // 1. Eliminar líneas de créditos o "Wanted for" (detecta con o sin asteriscos **)
    if (lineaTrim.includes('Credits') || lineaTrim.includes('Wanted for')) {
      continue
    }
    
    // 2. Eliminar línea de LEGEND (emojis)
    if (lineaTrim.includes('LEGEND')) {
      continue
    }
    
    // 3. Reemplazar el encabezado de LEDERDATA por SOSI_CODEX
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
  const chatId = entidad.id // ✅ Extraer SOLO el ID numérico
  
  const mensajes = []
  let ultimo = Date.now()
  let timeoutId = null
  
  // ✅ Usar Promises en lugar de while(true) para no bloquear WhatsApp
  const respuestaPromise = new Promise((resolve) => {
    const handler = (evento) => {
      mensajes.push(evento.message)
      ultimo = Date.now()
      
      if (timeoutId) clearTimeout(timeoutId)
      
      timeoutId = setTimeout(() => {
        tg.removeEventHandler(handler, filtro)
        resolve(mensajes)
      }, 2000)
    }
    
    // ✅ Pasar el chatId numérico, NO el objeto entidad
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
    // ✅ Aplicar la limpieza del texto aquí
    const item = { texto: limpiarTextoTelegram(m.text || m.message || '') }
    
    if (m.photo) {
      item.tipo = 'imagen'
      item.buffer = await tg.downloadMedia(m) // ✅ Sin parámetros extra
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