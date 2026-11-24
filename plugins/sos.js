// plugins/sos.js
export const chatsConIA = new Set();

export default {
  command: ['sos', 'bs'],
  cost: 0,
  exec: async ({ sock, msg, from, args, command, sender }) => {
    if (command === 'sos') {
      if (chatsConIA.has(from)) {
        await sock.sendMessage(from, { text: 'Ya está activo en este chat.' }, { quoted: msg });
        return false;
      }
      chatsConIA.add(from);
      await sock.sendMessage(from, { text: 'Modo persona activado. Escribe lo que quieras.' }, { quoted: msg });
      return false;
    } 
    
    if (command === 'bs') {
      if (!chatsConIA.has(from)) {
        await sock.sendMessage(from, { text: 'Ya estaba desactivado.' }, { quoted: msg });
        return false;
      }
      chatsConIA.delete(from);
      await sock.sendMessage(from, { text: 'Modo persona desactivado.' }, { quoted: msg });
      return false;
    }
  }
}