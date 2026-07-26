import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { botConfig } from '../config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Helpers para configuración de grupos ---
const getConfigGrupos = () => {
  if (!fs.existsSync('./gruposBienvenida.json')) return {}
  return JSON.parse(fs.readFileSync('./gruposBienvenida.json', 'utf-8'))
}

const saveConfigGrupos = (data) => {
  fs.writeFileSync('./gruposBienvenida.json', JSON.stringify(data, null, 2))
}
// ---------------------------------------------

export default {
  command: ['bienvenida'],
  description: 'Activa/desactiva la bienvenida automática en el grupo: .bienvenida on / .bienvenida off',
  exec: async ({ sock, from, msg, args, sender }) => {
    // Solo funciona dentro de un grupo
    if (!from.endsWith('@g.us')) {
      await sock.sendMessage(from, { text: '❌ Este comando solo funciona dentro de un grupo.' }, { quoted: msg })
      return false
    }

    // Verificar que quien ejecuta sea admin del grupo
    const metadata = await sock.groupMetadata(from)

    const numeroSender = sender.split('@')[0].split(':')[0]

    const participante = metadata.participants.find(p => {
      const numeroId = p.id?.split('@')[0].split(':')[0]
      const numeroLid = p.lid?.split('@')[0].split(':')[0]
      return numeroId === numeroSender || numeroLid === numeroSender
    })

    const esAdminGrupo = participante && (participante.admin === 'admin' || participante.admin === 'superadmin')

    if (!esAdminGrupo) {
      await sock.sendMessage(from, { text: '❌ Solo un administrador del grupo puede activar o desactivar la bienvenida.' }, { quoted: msg })
      return false
    }

    const opcion = args[0]?.toLowerCase()

    if (opcion !== 'on' && opcion !== 'off') {
      await sock.sendMessage(from, { text: `⚙️ Uso correcto:\n${botConfig.prefix}bienvenida on\n${botConfig.prefix}bienvenida off` }, { quoted: msg })
      return false
    }

    const config = getConfigGrupos()
    config[from] = opcion === 'on'
    saveConfigGrupos(config)

    await sock.sendMessage(from, {
      text: opcion === 'on'
        ? '✅ Bienvenida *activada* para este grupo.'
        : '🚫 Bienvenida *desactivada* para este grupo.'
    }, { quoted: msg })
  }
}

// --- Función del evento, exportada para usarse en el archivo principal ---
export async function handleGroupParticipantsUpdate(sock, update) {
  const { id, participants, action } = update

  if (action !== 'add') return

  // Verificar si la bienvenida está activada para este grupo
  const config = getConfigGrupos()
  if (!config[id]) return // Si no está activada (true), no hace nada

  // Procesamos todos los que se unieron en paralelo (no uno por uno)
  await Promise.all(participants.map(async (raw) => {
    try {
      const participant = typeof raw === 'string'
        ? raw
        : (raw?.phoneNumber || raw?.id || raw?.jid || raw?.lid || null)

      if (!participant || typeof participant !== 'string') return

      const nombreUsuario = participant.split('@')[0]
      const ahora = new Date()
      const fecha = ahora.toLocaleDateString('es-PE')
      const hora = ahora.toLocaleTimeString('es-PE')

      const mensajeBienvenida = `🐾 〔 *${botConfig.botName}* 〕🐾
   _Bot inteligente de consultas_
━━━━━━━━━━━━━━━━━━━━

🎉 ¡Bienvenido/a, *${nombreUsuario}*!

┌─ 📋 *DATOS DE INGRESO*
│ 👤 Nombre    : ${nombreUsuario}
│ 📅 Fecha     : ${fecha}
│ 🕐 Hora      : ${hora}
└────────────────

🔍 Aquí puedes acceder a consultas de:
   DNI, familiares, direcciones, sueldos,
   vehículos, SOAT y mucho más.

📝 Para comenzar, regístrate con:
   ${botConfig.prefix}registrar nombre|contraseña

📜 Luego usa *${botConfig.prefix}menu* para
   ver todos los comandos disponibles.

━━━━━━━━━━━━━━━━━━━━
🐾 *${botConfig.botName}* © ${new Date().getFullYear()}`

      const imagenBienvenida = path.join(__dirname, '..', 'media', 'bienvenida.png')

      if (fs.existsSync(imagenBienvenida)) {
        await sock.sendMessage(id, {
          image: fs.readFileSync(imagenBienvenida),
          caption: mensajeBienvenida
        })
      } else {
        await sock.sendMessage(id, { text: mensajeBienvenida })
      }

    } catch (err) {
      console.error('Error en bienvenida:', err.message)
    }
  }))
}
