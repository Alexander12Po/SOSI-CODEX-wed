import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { botConfig } from '../config.js'
import { costoPorComando } from '../costos.js'
import User from '../models/User.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function limpiarNombre(nombre) {
  if (!nombre) return 'Usuario'
  const primeraPalabra = nombre.trim().split(/\s+/)[0]
  return primeraPalabra.length > 0 ? primeraPalabra : 'Usuario'
}

// --- Mapa manual de categorías por comando ---
const categoriaPorComando = {
  addcredito: 'ADMIN',
  setcredito: 'ADMIN',
  listausuarios: 'ADMIN',
  usuarios: 'ADMIN',
  verusuario: 'ADMIN',

  registrar: 'USUARIO',
  credito: 'USUARIO',
  perfil: 'USUARIO',
  comprar: 'USUARIO',

  menu: 'GENERAL',
  help: 'GENERAL',
  info: 'GENERAL',
  ping: 'GENERAL',
  cmds: 'ACCESO_RAPIDO',
  sosi: 'A_MAS_COMANDOS',

  // Los comandos de consultas ya no se listan uno por uno en el .menu:
  // ahora se agrupan y se ven todos juntos con el comando .cmds
  ag: 'CONSULTAS',
  denuncias: 'CONSULTAS',
  dir: 'CONSULTAS',
  dni: 'CONSULTAS',
  dniamarillo: 'CONSULTAS',
  dniazul: 'CONSULTAS',
  dnielectronico: 'CONSULTAS',
  fiscalia: 'CONSULTAS',
  nm: 'CONSULTAS',
  placa: 'CONSULTAS',
  rfm: 'CONSULTAS',
  soat: 'CONSULTAS',
  sueldo: 'CONSULTAS',
  telp: 'CONSULTAS',
  vv: 'CONSULTAS'
}

// 'CONSULTAS' ya no está en esta lista: por eso esa categoría no se
// imprime en el .menu, aunque los comandos sigan clasificados arriba
// (por si en el futuro se quiere usar esa clasificación en otro lado, como en .cmds).
const ordenCategorias = ['ACCESO_RAPIDO', 'ADMIN', 'USUARIO', 'GENERAL', 'OTROS']

const emojiCategoria = {
  ACCESO_RAPIDO: '🔎',
  ADMIN: '👑',
  USUARIO: '👤',
  GENERAL: '🌐',
  CONSULTAS: '🔎',
  OTROS: '📦'
}

// Emoji sugerido por comando (si no está aquí, usa uno genérico)
const emojiComando = {
  addcredito: '💳',
  listausuarios: '👥',
  registrar: '📝',
  credito: '💎',
  comprar: '🛒',
  menu: '📖',
  info: '🤖',
  ping: '🏓',
  cmds: '🔎',
  sosi: '🚧',
  dni: '🪪',
  nm: '👤',
  telp: '📱',
  placa: '🚗',
  dir: '🏠',
  ag: '🌳',
  sueldo: '💼',
  soat: '🛡️',
  fiscalia: '⚖️',
  denuncias: '🚨',
  rfm: '📂',
  vv: '👁️',
  dnielectronico: '💳'
}

export default {
  command: ['menu', 'help'],
  description: 'Muestra el menú de comandos',
  exec: async ({ sock, from, msg, sender }) => {
    // --- Verificar registro antes de mostrar el menú ---
    const usuario = await User.findOne({ numero: sender })

    if (!usuario) {
      return sock.sendMessage(from, {
        text: `╔═══📝 *REGISTRO REQUERIDO* 📝═══
║
║ Aún no estás registrado.
║
║ 👉 Usa: *${botConfig.prefix}registrar nombre|password*
║
╚══════════════════════╝`
      }, { quoted: msg })
    }
    // ----------------------------------------------------

    const { getUniquePlugins } = await import('../handler.js')
    const nombre = limpiarNombre(usuario.nombre || msg.pushName)
    const commandList = getUniquePlugins()

    // --- Agrupar comandos por categoría ---
    const categorias = {}
    for (const p of commandList) {
      const cmdPrincipal = p.command[0]
      const cat = categoriaPorComando[cmdPrincipal] || 'OTROS'
      if (!categorias[cat]) categorias[cat] = []
      categorias[cat].push(p)
    }

    let bloquesCategorias = ''
    for (const cat of ordenCategorias) {
      const plugins = categorias[cat]
      if (!plugins || plugins.length === 0) continue

      const emoji = emojiCategoria[cat] || '📂'
      const tituloLinea = `╭──── ${emoji} ${cat} ────╮`
      const cierreLinea = '╰' + '─'.repeat(tituloLinea.length - 2) + '╯'

      const items = plugins
        .map(p => {
          const cmdPrincipal = p.command[0]
          const emojiCmd = emojiComando[cmdPrincipal] || '✧'
          const costo = costoPorComando.hasOwnProperty(cmdPrincipal) ? costoPorComando[cmdPrincipal] : null
          let etiquetaCosto = ''
          if (costo === 0) etiquetaCosto = ' 🆓'
          else if (costo !== null) etiquetaCosto = ` 💰${costo}`

          return `│ ${emojiCmd} .${cmdPrincipal}${etiquetaCosto}\n│ ➜ ${p.description}\n│`
        })
        .join('\n')

      bloquesCategorias += `${tituloLinea}\n${items}\n${cierreLinea}\n\n`
    }
    // ----------------------------------------------------------

    const caption = `╔════════════════════╗
║ 🤖 ${botConfig.botName}
║ 🇵🇪 CONSULTAS PERÚ
╚════════════════════╝

╭──── 👤 PERFIL ────╮
│ Hola: *${nombre}*
│ 💎 Créditos: ${usuario.creditos}
│ 🟢 Estado: ONLINE
╰───────────────────╯

${bloquesCategorias}╭───────────────────╮
│ 🔰 ${botConfig.botName} VIP
│ ⚡ Sistema activo
╰───────────────────╯`

    const esURL = /^https?:\/\//i.test(botConfig.menuImage)

    if (esURL) {
      await sock.sendMessage(
        from,
        { image: { url: botConfig.menuImage }, caption },
        { quoted: msg }
      )
    } else {
      const imagePath = path.join(__dirname, '..', botConfig.menuImage)
      if (fs.existsSync(imagePath)) {
        await sock.sendMessage(
          from,
          { image: fs.readFileSync(imagePath), caption },
          { quoted: msg }
        )
      } else {
        await sock.sendMessage(from, { text: caption }, { quoted: msg })
      }
    }
  }
}
