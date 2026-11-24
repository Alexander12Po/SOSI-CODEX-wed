// plugins/hd.js

// Este Set guarda los IDs de los chats donde la IA está activa
export const chatsConIA = new Set();

export default {
  command: ['hd', 'bh'],
  cost: 0, // Gratis, no cobra créditos
  exec: async ({ sock, msg, from, args, command, sender }) => {
    if (command === 'hd') {
      if (chatsConIA.has(from)) {
        await sock.sendMessage(from, { text: 'Ya está activo en este chat.' }, { quoted: msg });
        return false;
        }
      chatsConIA.add(from);
      await sock.sendMessage(from, { text: 'Modo persona activado. Escribe lo que quieras.' }, { quoted: msg });
      return false;
    } 
    
    if (command === 'bh') {
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