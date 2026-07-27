import { botConfig } from '../config.js'
import os from 'os'

export default {
  command: ['info', 'about'],
  description: 'Muestra información del bot',
  exec: async ({ sock, from, msg }) => {
    const uptime = process.uptime()
    const h = Math.floor(uptime / 3600)
    const min = Math.floor((uptime % 3600) / 60)
    const sec = Math.floor(uptime % 60)

    const text = `╭─❐ *Información* ❐
│ 🤖 Nombre: ${botConfig.botName}
│ 📶 Prefijo: ${botConfig.prefix}
│ ⏱️ Uptime: ${h}h ${min}m ${sec}s
│ 💻 Plataforma: ${os.platform()}
╰────────────`
    await sock.sendMessage(from, { text }, { quoted: msg })
  }
}
