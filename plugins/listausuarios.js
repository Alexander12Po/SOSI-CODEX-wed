import { botConfig } from '../config.js';
import User from '../models/User.js';

export default {
  command: ['listausuarios', 'usuarios'],
  description: 'Admin: lista todos los usuarios registrados y sus créditos',
  exec: async ({ sock, from, msg, sender }) => {
    if (!botConfig.admins.includes(sender)) {
      return sock.sendMessage(from, { text: '❌ No tienes permiso para usar este comando.' }, { quoted: msg });
    }

    const usuarios = await User.find();

    if (usuarios.length === 0) {
      return sock.sendMessage(from, { text: '📭 No hay usuarios registrados todavía.' }, { quoted: msg });
    }

    let texto = `╔═══👥 *USUARIOS REGISTRADOS* 👥═══\n║\n`;
    usuarios.forEach((datos, i) => {
      texto += `║ ${i + 1}. *${datos.nombre}*\n║    📱 ${datos.numero}\n║    💰 ${datos.creditos} créditos\n║    📅 ${datos.fecha}\n║\n`;
    });
    texto += `╚═══ Total: ${usuarios.length} usuario(s) ═══╝`;

    sock.sendMessage(from, { text: texto }, { quoted: msg });
  }
}
