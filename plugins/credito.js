import User from '../models/User.js';

export default {
  command: ['credito', 'perfil'],
  description: 'Muestra tu perfil y créditos disponibles',
  exec: async ({ sock, from, msg, sender }) => {
    const user = await User.findOne({ numero: sender });

    if (!user) {
      return sock.sendMessage(from, { text: '❌ No estás registrado. Usa `.registrar nombre|contraseña`.' }, { quoted: msg });
    }

    const perfil = `╔═════👤 *PERFIL* 👤═════
║ 👤 Nombre: ${user.nombre}
║ 💰 Créditos: ${user.creditos}
║ 📅 Registro: ${user.fecha}
╚══════════════════════╝`;

    sock.sendMessage(from, { text: perfil }, { quoted: msg });
  }
}
