import { TelegramClient } from 'telegram/index.js'
import { StringSession } from 'telegram/sessions/index.js'
import { NewMessage } from 'telegram/events/index.js'

const BOT = 'noticiasbot'
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

async function consultarInterno(comando) {
  const tg = await getClient()
  const entidad = await tg.getInputEntity(BOT)
  
  const mensajes = []
  let ultimo = Date.now()
  let timeoutId = null
  
  // Crear una Promise que se resuelve cuando llegan los mensajes
  const respuestaPromise = new Promise((resolve) => {
    const handler = (evento) => {
      mensajes.push(evento.message)
      ultimo = Date.now()
      
      if (timeoutId) clearTimeout(timeoutId)
      
      // Esperar 2 segundos después del último mensaje
      timeoutId = setTimeout(() => {
        tg.removeEventHandler(handler, filtro)
        resolve(mensajes)
      }, 2000)
    }
    
    const filtro = new NewMessage({ chats: [entidad], incoming: true })
    tg.addEventHandler(handler, filtro)
    
    // Timeout de seguridad: 15 segundos
    setTimeout(() => {
      tg.removeEventHandler(handler, filtro)
      resolve(mensajes)
    }, 15000)
  })
  
  // Enviar el mensaje
  await tg.sendMessage(entidad, { message: comando })
  
  // Esperar la respuesta sin bloquear el event loop
  const resultados = await respuestaPromise
  
  // Procesar los mensajes
  const salida = []
  for (const m of resultados) {
    const item = { texto: m.text || m.message || '' }
    
    if (m.photo) {
      // Es una imagen
      item.tipo = 'imagen'
      item.buffer = await tg.downloadMedia(m, { outputFile: Buffer })
    } else if (m.document) {
      // Es un documento
      item.tipo = 'documento'
      item.buffer = await tg.downloadMedia(m, { outputFile: Buffer })
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
