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
  
  // Usar getInputEntity para obtener el formato correcto
  const entidad = await tg.getInputEntity(BOT)
  
  const mensajes = []
  let ultimo = Date.now()
  let timeoutId = null
  
  const handler = (evento) => {
    mensajes.push(evento.message)
    ultimo = Date.now()
    
    if (timeoutId) clearTimeout(timeoutId)
    
    timeoutId = setTimeout(() => {
      tg.removeEventHandler(handler, filtro)
    }, 2000)
  }
  
  const filtro = new NewMessage({ chats: [entidad], incoming: true })
  tg.addEventHandler(handler, filtro)
  
  try {
    await tg.sendMessage(entidad, { message: comando })
    
    const inicio = Date.now()
    while (true) {
      await new Promise((r) => setTimeout(r, 500))
      const ahora = Date.now()
      
      if (!mensajes.length && ahora - inicio > 10000) break
      if (mensajes.length && ahora - ultimo > 2000) break
      if (ahora - inicio > 15000) break
    }
  } finally {
    tg.removeEventHandler(handler, filtro)
    if (timeoutId) clearTimeout(timeoutId)
  }
  
  const salida = []
  for (const m of mensajes) {
    const item = { texto: m.message || '' }
    if (m.media) {
      item.buffer = await tg.downloadMedia(m)
      item.tipo = m.photo ? 'imagen' : 'documento'
      item.nombre = m.file?.name || 'archivo'
      item.mime = m.file?.mimeType
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
