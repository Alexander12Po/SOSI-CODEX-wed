import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { botConfig } from '../config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  command: ['cmds', 'consultas'],
  description: 'Muestra las consultas disponibles (DNI, SOAT, placa, árbol genealógico y más)',
  exec: async ({ sock, from, msg }) => {

    const texto = `╔════════════════════╗
║ 🤖 ${botConfig.botName}
║ 🇵🇪 CONSULTAS PERÚ
╚════════════════════╝

╭──── 🔎 CONSULTAS ────╮
│ 🌳 ${botConfig.prefix}ag 💰10
│ ➜ Consulta el árbol genealógico y relaciones familiares por DNI
│
│ 🏠 ${botConfig.prefix}dir 💰6
│ ➜ Consulta el historial de direcciones de una persona por su DNI
│
│ 🪪 ${botConfig.prefix}dni 💰1
│ ➜ Consulta datos detallados de una persona por su DNI (Perú)
│
│ 🖼️ ${botConfig.prefix}dnit 💰8
│ ➜ Ficha completa de DNI con fotos, domicilio y ubigeos
│
│ 📸 ${botConfig.prefix}dnivel 💰5
│ ➜ Consulta DNI con imágenes (formato rápido)
│
│ 📷 ${botConfig.prefix}dniv 💰5
│ ➜ Consulta DNI con imágenes (formato PNG)
│
│ 👤 ${botConfig.prefix}nm 💰2
│ ➜ Busca personas por Nombres y Apellidos
│
│ 🚗 ${botConfig.prefix}placa 💰5
│ ➜ Consulta información de un vehículo por su número de placa
│
│ 📋 ${botConfig.prefix}plat 💰8
│ ➜ Ficha técnica completa del vehículo (series, propietarios)
│
│ 📂 ${botConfig.prefix}rfm 💰20
│ ➜ Consulta RFM
│
│ 🛡️ ${botConfig.prefix}soat 💰10
│ ➜ Consulta el estado y vigencia del SOAT de un vehículo por su placa
│
│ 💼 ${botConfig.prefix}sueldo 💰10
│ ➜ Consulta el historial de sueldos y empleos de una persona por su DNI
│
│ 📱 ${botConfig.prefix}telp 💰5
│ ➜ Consulta Teléfono
│
│ 📲 ${botConfig.prefix}telpx 💰5
│ ➜ Consulta Teléfono (variante extendida)
│
│ 🚨 ${botConfig.prefix}den 💰15
│ ➜ Resumen de denuncias (condición e intervención) por DNI
│
│ 📄 ${botConfig.prefix}denuncias 💰20
│ ➜ Consulta denuncias policiales con documentos por DNI
│
│ 🚔 ${botConfig.prefix}denpla 💰20
│ ➜ Consulta denuncias policiales por placa
│
│ ⚖️ ${botConfig.prefix}rqh 💰15
│ ➜ Consulta requisitorias y procesos judiciales por DNI
│
│ 👁️ ${botConfig.prefix}vv 🆓
│ ➜ Descarga fotos y videos enviados para ver una sola vez
│
╰──────────────────────╯

╭───────────────────╮
│ 🔰 ${botConfig.botName} VIP
│ ⚡ Sistema activo
╰───────────────────╯`

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
