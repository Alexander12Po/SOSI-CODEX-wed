import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { botConfig } from '../config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Extrae el subcomando (ej: "reniec" en ".cmds reniec") con o sin args del framework
function getSub(msg, args) {
  if (Array.isArray(args) && args.length) return (args[0] || '').toLowerCase()
  const body =
    msg?.body ||
    msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text ||
    ''
  const parts = body.trim().split(/\s+/)
  return (parts[1] || '').toLowerCase()
}

const menuPrincipal = () => `╔════════════════════════════╗
║      🤖 *${botConfig.botName}* 🐾     ║
╚════════════════════════════╝
      🐾 *CONSULTAS PERÚ* 🐾

Escribe el comando de la categoría
que deseas consultar.

━━━━━━━━━━━━━━━━━━━━

🪪 *RENIEC*
➜ \`${botConfig.prefix}cmds reniec\`

🌳 *ÁRBOL GENEALÓGICO*
➜ \`${botConfig.prefix}cmds arbol\`

📸 *RECONOCIMIENTO FACIAL*
➜ \`${botConfig.prefix}cmds facial\`

🏠 *DIRECCIONES*
➜ \`${botConfig.prefix}cmds direcciones\`

🚗 *VEHÍCULOS*
➜ \`${botConfig.prefix}cmds vehiculos\`

📱 *TELÉFONOS*
➜ \`${botConfig.prefix}cmds telefonos\`

💼 *SUELDOS*
➜ \`${botConfig.prefix}cmds sueldos\`

⚖️ *LEGAL*
➜ \`${botConfig.prefix}cmds legal\`

✨ *EXTRAS*
➜ \`${botConfig.prefix}cmds extras\`

━━━━━━━━━━━━━━━━━━━━
🤖 *${botConfig.botName}* 🐾
✨ *Consultas PERÚ*
━━━━━━━━━━━━━━━━━━━━`

const menuReniec = () => `📌 SECCIÓN: RENIEC
📊 CANTIDAD: 5 COMANDOS

📍 RENIEC DNI
Estado → ON 🟢
Costo → 1 coin
Uso → \`${botConfig.prefix}dni 12345678\`
Desc → Consulta de datos disponibles por DNI.
--------------------

📍 RENIEC FICHA
Estado → ON 🟢
Costo → 8 coin
Uso → \`${botConfig.prefix}dnit 12345678\`
Desc → Genera una ficha con la información disponible.
--------------------

📍 DNI IMÁGENES
Estado → ON 🟢
Costo → 5 coin
Uso → \`${botConfig.prefix}dnivel 12345678\`
Desc → Consulta con imágenes en formato rápido.
--------------------

📍 DNI PNG
Estado → ON 🟢
Costo → 5 coin
Uso → \`${botConfig.prefix}dniv 12345678\`
Desc → Genera la consulta en formato PNG.
--------------------

📍 BÚSQUEDA POR NOMBRES
Estado → ON 🟢
Costo → 2 coin
Uso → \`${botConfig.prefix}nm Nombres Apellidos\`
Desc → Búsqueda por nombres y apellidos.`

const menuArbol = () => `📌 SECCIÓN: ÁRBOL GENEALÓGICO
📊 CANTIDAD: 1 COMANDO

📍 ÁRBOL GENEALÓGICO
Estado → ON 🟢
Costo → 10 coin
Uso → \`${botConfig.prefix}ag 12345678\`
Desc → Consulta relaciones familiares disponibles.`

const menuFacial = () => `📌 SECCIÓN: RECONOCIMIENTO FACIAL
📊 CANTIDAD: 1 COMANDO

📍 RECONOCIMIENTO FACIAL
Estado → PENDIENTE 🟡
Costo → ?
Uso → \`${botConfig.prefix}facial\`
Desc → Función pendiente de configuración.`

const menuDirecciones = () => `📌 SECCIÓN: DIRECCIONES
📊 CANTIDAD: 1 COMANDO

📍 HISTORIAL DE DIRECCIONES
Estado → ON 🟢
Costo → 6 coin
Uso → \`${botConfig.prefix}dir 12345678\`
Desc → Consulta información de direcciones disponible.`

const menuVehiculos = () => `📌 SECCIÓN: VEHÍCULOS
📊 CANTIDAD: 3 COMANDOS

📍 VEHÍCULO POR PLACA
Estado → ON 🟢
Costo → 5 coin
Uso → \`${botConfig.prefix}placa ABC123\`
Desc → Consulta información disponible del vehículo.
--------------------

📍 FICHA DEL VEHÍCULO
Estado → ON 🟢
Costo → 8 coin
Uso → \`${botConfig.prefix}plat ABC123\`
Desc → Consulta información técnica disponible.
--------------------

📍 SOAT
Estado → ON 🟢
Costo → 10 coin
Uso → \`${botConfig.prefix}soat ABC123\`
Desc → Consulta estado y vigencia del SOAT.`

const menuTelefonos = () => `📌 SECCIÓN: TELÉFONOS
📊 CANTIDAD: 2 COMANDOS

📍 TELÉFONO
Estado → ON 🟢
Costo → 5 coin
Uso → \`${botConfig.prefix}telp 999999999\`
Desc → Consulta información telefónica disponible.
--------------------

📍 TELÉFONO EXTENDIDO
Estado → ON 🟢
Costo → 5 coin
Uso → \`${botConfig.prefix}telpx 999999999\`
Desc → Consulta telefónica en formato extendido.`

const menuSueldos = () => `📌 SECCIÓN: SUELDOS
📊 CANTIDAD: 1 COMANDO

📍 HISTORIAL LABORAL
Estado → ON 🟢
Costo → 10 coin
Uso → \`${botConfig.prefix}sueldo 12345678\`
Desc → Consulta información laboral disponible.`

const menuLegal = () => `📌 SECCIÓN: LEGAL
📊 CANTIDAD: 4 COMANDOS

📍 DENUNCIAS
Estado → ON 🟢
Costo → 15 coin
Uso → \`${botConfig.prefix}den 12345678\`
Desc → Resumen de denuncias por DNI.
--------------------

📍 DENUNCIAS POLICIALES
Estado → ON 🟢
Costo → 20 coin
Uso → \`${botConfig.prefix}denuncias 12345678\`
Desc → Consulta documentos policiales.
--------------------

📍 DENUNCIAS POR PLACA
Estado → ON 🟢
Costo → 20 coin
Uso → \`${botConfig.prefix}denpla ABC123\`
Desc → Consulta denuncias del vehículo.
--------------------

📍 REQUISITORIAS
Estado → ON 🟢
Costo → 15 coin
Uso → \`${botConfig.prefix}rqh 12345678\`
Desc → Consulta requisitorias y procesos judiciales.`

const menuExtras = () => `📌 SECCIÓN: EXTRAS
📊 CANTIDAD: 2 COMANDOS

📍 VER UNA VEZ
Estado → ON 🟢
Costo → Gratis 🆓
Uso → \`${botConfig.prefix}vv\`
Desc → Descarga fotos y videos enviados para ver una sola vez.
--------------------

📍 RFM
Estado → ON 🟢
Costo → 20 coin
Uso → \`${botConfig.prefix}rfm 12345678\`
Desc → Consulta información RFM.`

const categorias = {
  reniec: menuReniec,
  arbol: menuArbol,
  facial: menuFacial,
  direcciones: menuDirecciones,
  vehiculos: menuVehiculos,
  telefonos: menuTelefonos,
  sueldos: menuSueldos,
  legal: menuLegal,
  extras: menuExtras
}

export default {
  command: ['cmds', 'consultas'],
  description: 'Muestra las consultas disponibles por categoría (DNI, SOAT, placa, árbol genealógico y más)',
  exec: async ({ sock, from, msg, args }) => {

    const sub = getSub(msg, args)
    const texto = categorias[sub] ? categorias[sub]() : menuPrincipal()

    const esURL = /^https?:\/\//i.test(botConfig.cmdsImage)

    if (esURL) {
      await sock.sendMessage(
        from,
        { image: { url: botConfig.cmdsImage }, caption: texto },
        { quoted: msg }
      )
    } else {
      const imagePath = path.join(__dirname, '..', botConfig.cmdsImage)
      if (fs.existsSync(imagePath)) {
        await sock.sendMessage(
          from,
          { image: fs.readFileSync(imagePath), caption: texto },
          { quoted: msg }
        )
      } else {
        await sock.sendMessage(from, { text: texto }, { quoted: msg })
      }
    }
  }
}