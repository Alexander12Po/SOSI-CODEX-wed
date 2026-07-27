export default {
  command: ['comprar'],
  description: 'Muestra el catálogo de paquetes y precios para recargar créditos',
  exec: async ({ sock, from, msg }) => {
    const texto = `╔════════════════════╗
║      💳 COMPRA DE CRÉDITOS      ║
╚════════════════════╝

📲 Adquiere créditos para seguir realizando consultas.

Contacto: +51 924 894 999

━━━━━━━━━━━━━━━━━━━━
📦 CATÁLOGO DE PAQUETES
━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────┐
│ 💠 500 Créditos + 50 Bonus      │ 💰 S/ 25
├─────────────────────────────┤
│ 💠 600 Créditos + 60 Bonus      │ 💰 S/ 30
├─────────────────────────────┤
│ 💠 700 Créditos + 70 Bonus      │ 💰 S/ 35
├─────────────────────────────┤
│ 💠 800 Créditos + 80 Bonus      │ 💰 S/ 40
├─────────────────────────────┤
│ 💠 900 Créditos + 90 Bonus      │ 💰 S/ 45
├─────────────────────────────┤
│ 💠 1.4K Créditos + 100 Bonus    │ 💰 S/ 50
├─────────────────────────────┤
│ 💠 4K Créditos + 100 Bonus      │ 💰 S/ 100
└─────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━
♾️ PLANES ILIMITADOS
━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────┐
│ 🔥 7 días                      │ 💰 S/ 50
├─────────────────────────────┤
│ 🔥 15 días                     │ 💰 S/ 75
├─────────────────────────────┤
│ 🔥 30 días                     │ 💰 S/ 100
├─────────────────────────────┤
│ 🔥 60 días                     │ 💰 S/ 150
├─────────────────────────────┤
│ 🔥 70 días                     │ 💰 S/ 250
└─────────────────────────────┘

✅ Activación rápida.
✅ Créditos disponibles al confirmar el pago.
💬 Escríbenos al +51 924 894 999 para comprar.`

    await sock.sendMessage(from, { text: texto }, { quoted: msg })
  }
}
