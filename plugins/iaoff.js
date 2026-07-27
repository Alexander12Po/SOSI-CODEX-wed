import { desactivarIA } from '../groq.js';

const plugin = {
  command: ['iaoff'],
  cost: 0,

  async exec({ sock, msg, from }) {
    await desactivarIA(from);
    await sock.sendMessage(from, { text: '🔕 IA desactivada en este chat.' }, { quoted: msg });
  }
};

export default plugin;
