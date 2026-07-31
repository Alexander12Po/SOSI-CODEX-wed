export default {
  command: ['nr'],
  exec: async ({ sock, msg, from }) => {
    // Solo funciona en chat privado
    if (from.endsWith('@g.us')) {
      return sock.sendMessage(from, {
        text: '❌ Este comando solo funciona en un chat privado.'
      }, { quoted: msg });
    }

    let numero = null;

    if (from.endsWith('@s.whatsapp.net')) {
      // Ya viene con el número real
      numero = from.split('@')[0];
    } else if (from.endsWith('@lid')) {
      // Es un LID, buscar el número real en el campo alterno del mensaje
      const alt = msg.key?.remoteJidAlt;
      if (alt && alt.endsWith('@s.whatsapp.net')) {
        numero = alt.split('@')[0];
      }
    }

    if (!numero) {
      return sock.sendMessage(from, {
        text: '⚠️ No se pudo obtener el número real de este contacto (WhatsApp no lo expuso en este mensaje).'
      }, { quoted: msg });
    }

    return sock.sendMessage(from, {
      text: `📱 Número de WhatsApp: +${numero}`
    }, { quoted: msg });
  }
};