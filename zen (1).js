import 'dotenv/config'
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  DisconnectReason
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import readline from 'readline'
import qrcode from 'qrcode-terminal'
import NodeCache from 'node-cache'
import { handler } from './handler.js'
import { botConfig } from './config.js'
import { handleGroupParticipantsUpdate } from './plugins/bienvenida.js'
import { cachearMensaje, manejarMensajeEliminado } from './plugins/antidelete.js'

// --- BLINDAJE GLOBAL: evita que errores no capturados tumben el bot ---
// Sin esto, un solo error (ej: una descarga de imagen que falla a medias)
// puede matar TODO el proceso de Node y forzar un reinicio completo del bot.
process.on('uncaughtException', (err) => {
  console.error('⚠️ Error no capturado (uncaughtException):', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Promesa rechazada no manejada (unhandledRejection):', reason)
})
// -----------------------------------------------------------------------

const question = (text) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.question(text, (answer) => {
    rl.close()
    resolve(answer)
  })
})

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./session')

  // 👇 Usamos fetchLatestWaWebVersion en vez de fetchLatestBaileysVersion:
  // esta última tiene actualmente un bug conocido que devuelve una versión
  // vieja de WhatsApp Web, lo que hace que la vinculación falle (error 428).
  const { version } = await fetchLatestWaWebVersion()

  const usePairing = botConfig.loginMethod === 'pairing'

  // Cache de metadatos de grupo, para evitar consultas repetidas que causan demora
  const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: ['SOSI CODEX', 'Chrome', '1.0.0'],
    cachedGroupMetadata: async (jid) => groupCache.get(jid)
  })

  let pairingRequested = false
  let phoneNumber = null

  if (usePairing && !sock.authState.creds.registered) {
    phoneNumber = (await question('Ingresa tu número con código de país (ej: 521234567890): ')).trim()
  }

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    // Método QR
    if (!usePairing && qr) {
      console.log('📲 Escanea este código QR con WhatsApp > Dispositivos vinculados:')
      qrcode.generate(qr, { small: true })
    }

    // Método código de vinculación (se pide justo cuando el socket ya está listo)
    if (usePairing && phoneNumber && !pairingRequested && (connection === 'connecting' || qr)) {
      pairingRequested = true
      try {
        const code = await sock.requestPairingCode(phoneNumber)
        console.log('╭───────────────────────╮')
        console.log(`   🔑 Código: ${code}`)
        console.log('╰───────────────────────╯')
        console.log('Ve a WhatsApp > Dispositivos vinculados > Vincular con número de teléfono, e ingresa el código.')
      } catch (err) {
        console.log('❌ Error generando el código:', err.message || err)
        pairingRequested = false
      }
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      console.log('❌ Conexión cerrada. Código:', statusCode, '| Motivo:', lastDisconnect?.error?.message || lastDisconnect?.error)
      console.log(shouldReconnect ? 'Reconectando...' : 'Sesión cerrada, borra la carpeta session y vuelve a vincular.')
      if (shouldReconnect) startBot()
    } else if (connection === 'open') {
      console.log(`✅ ${botConfig.botName} conectado correctamente`)
    }
  })

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return

    const msg = m.messages[0]
    if (!msg?.message) return

    try {
      // Si es un mensaje de "eliminar" (Eliminar para todos), intentamos
      // recuperar la copia guardada en cache y reenviarla.
      if (msg.message.protocolMessage?.type === 0 /* REVOKE */) {
        await manejarMensajeEliminado(sock, msg)
        return
      }

      // Guardamos copia del mensaje por si luego lo eliminan.
      // NO esperamos a que termine (es solo para el antidelete, no debe
      // retrasar la respuesta del comando que el usuario está pidiendo).
      cachearMensaje(msg).catch((err) => console.error('Error cacheando mensaje:', err.message))

      await handler(sock, m)
    } catch (err) {
      console.error('Error en handler:', err)
    }
  })

  // Evento para detectar nuevos participantes y enviar la bienvenida
  sock.ev.on('group-participants.update', async (update) => {
    try {
      await handleGroupParticipantsUpdate(sock, update)
    } catch (err) {
      console.error('Error en evento de bienvenida:', err)
    }
  })
}

startBot()
