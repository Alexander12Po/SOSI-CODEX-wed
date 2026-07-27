export default {
  command: ['fiscalia'],
  description: 'Consulta Fiscalía',

  exec: async ({ sock, from, msg }) => {
    await sock.sendMessage(from, {
      text: `━━━━━━━━━━━━━━━━━━
⚖️ CONSULTA FISCALÍA
━━━━━━━━━━━━━━━━━━
💎 Servicio exclusivo para usuarios Premium.
━━━━━━━━━━━━━━━━━━
🧑‍💻 Soporte Técnico
━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg })
  }
}
