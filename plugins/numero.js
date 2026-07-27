// plugins/numero.js
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export default {
  command: ['numero', 'operador' , `nr`],
  cost: 1,
  exec: async ({ sock, msg, from, args }) => {
    const input = args[0] || '';

    if (!input) {
      await sock.sendMessage(from, {
        text: '❌ Debes indicar un número con código de país.\nEjemplo: *.numero +51987654321*'
      }, { quoted: msg });
      return false;
    }

    try {
      const numero = parsePhoneNumberFromString(input);

      if (!numero || !numero.isValid()) {
        await sock.sendMessage(from, {
          text: '❌ Ese número no parece válido. Asegúrate de incluir el código de país (ej: +51...).'
        }, { quoted: msg });
        return false;
      }

      const respuesta = `╭══════════════════════╮
│   📞 INFO DE NÚMERO   │
╰══════════════════════╯

📱 *Número:* ${numero.number}
🏳️ *País:* ${numero.country || 'Desconocido'}
📡 *Tipo de línea:* ${numero.getType() || 'No determinado'}
🌍 *Código país:* +${numero.countryCallingCode}

⚠️ Nota: el operador exacto no siempre es determinable porque los números pueden portarse entre compañías.

━━━━━━━━━━━━━━━━━━
🤖 *SOSI CODEX*`;

      await sock.sendMessage(from, { text: respuesta }, { quoted: msg });

    } catch (error) {
      console.error('Error en comando numero:', error.message);
      await sock.sendMessage(from, {
        text: '⚠️ Ocurrió un error al procesar el número.'
      }, { quoted: msg });
      return false;
    }
  }
};
