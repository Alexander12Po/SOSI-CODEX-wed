import { activarIA } from '../groq.js';

const plugin = {
  command: ['iaon'],
  cost: 0,

  async exec({ sock, msg, from }) {
    await activarIA(from);
    await sock.sendMessage(from, { text: '✅ IA activada en este chat. Ahora responderé automáticamente a los mensajes.' }, { quoted: msg });
  }
};

export default plugin;
