// plugins/perfil.js
export default {
  command: ['perfil', 'perfilwa', 'pr'],
  cost: 1,
  exec: async ({ sock, msg, from, args }) => {
    const numero = args[0] || '';

    if (!numero) {
      await sock.sendMessage(from, {
        text: '❌ Debes indicar un número.\nEjemplo: *.perfil +51904221766*'
      }, { quoted: msg });
      return false;
    }

    // Limpiar el número y armar el JID
    const numeroLimpio = numero.replace(/[^0-9]/g, '');
    const jid = `${numeroLimpio}@s.whatsapp.net`;

    try {
      // Verificar si el número existe en WhatsApp
      const [existe] = await sock.onWhatsApp(jid);

      if (!existe?.exists) {
        await sock.sendMessage(from, { text: '❌ Ese número no está registrado en WhatsApp.' }, { quoted: msg });
        return false;
      }

      const jidReal = existe.jid;

      // Obtener foto de perfil (en la mejor calidad disponible)
      let fotoUrl = null;
      try {
        fotoUrl = await sock.profilePictureUrl(jidReal, 'image');
      } catch (e) {
        fotoUrl = null; // no tiene foto o la privacidad no lo permite
      }

      // Obtener el "about" / estado
      let about = 'No disponible (privacidad restringida)';
      try {
        const status = await sock.fetchStatus(jidReal);
        if (status?.status) about = status.status;
      } catch (e) {
        // se queda el mensaje por defecto
      }

      const respuesta = `╭══════════════════════╮
│   👤 PERFIL WHATSAPP   │
╰══════════════════════╯

📱 *Número:* +${numeroLimpio}
📝 *Info/Estado:* ${about}
🖼️ *Foto:* ${fotoUrl ? 'Disponible ⬇️' : 'No tiene o está oculta'}

━━━━━━━━━━━━━━━━━━
🤖 *SOSI CODEX*`;

      if (fotoUrl) {
        await sock.sendMessage(from, {
          image: { url: fotoUrl },
          caption: respuesta
        }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: respuesta }, { quoted: msg });
      }

    } catch (error) {
      console.error('Error en perfil:', error.message);
      await sock.sendMessage(from, { text: '⚠️ Ocurrió un error al consultar el perfil.' }, { quoted: msg });
      return false;
    }
  }
};