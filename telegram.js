import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { NewMessage } from 'telegram/events'

const BOT = 'noticiasbot'

let client = null
let cola = Promise.resolve() // para que dos comandos no se pisen en el mismo cliente

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
  const entidad = await tg.getEntity(BOT)

  const mensajes = []
  let ultimo = Date.now()

  const handler = (evento) => {
    mensajes.push(evento.message)
    ultimo = Date.now()
  }

  const filtro = new NewMessage({ chats: [entidad], incoming: true })
  tg.addEventHandler(handler, filtro)

  try {
    await tg.sendMessage(entidad, { message: comando })

    const inicio = Date.now()
    while (true) {
      await new Promise((r) => setTimeout(r, 500))
      const ahora = Date.now()
      if (!mensajes.length && ahora - inicio > 10000) break // nunca respondió
      if (mensajes.length && ahora - ultimo > 3000) break // terminó de mandar todo
      if (ahora - inicio > 30000) break // límite duro de seguridad
    }
  } finally {
    tg.removeEventHandler(handler, filtro)
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

// Encola las consultas: si dos personas usan un comando casi al mismo
// tiempo, la segunda espera a que termine la primera, en vez de
// compartir los mismos listeners del cliente de Telegram a la vez.
export function consultarTelegram(comando) {
  const tarea = cola.then(() => consultarInterno(comando))
  cola = tarea.catch(() => {}) // que un error no trabe la cola para el siguiente
  return tarea
}

// Reenvía a WhatsApp lo que llegó de Telegram: texto, imágenes con
// caption, y documentos (PDF).
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
