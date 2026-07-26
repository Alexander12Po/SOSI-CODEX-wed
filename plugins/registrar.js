import { botConfig } from '../config.js';
import User from '../models/User.js';

export default {
  command: ['registrar'],
  description: 'Regístrate en el bot: .registrar nombre|password',
  exec: async ({ sock, from, msg, args, sender }) => {
    const input = args.join(' ').split('|');

    if (input.length < 2) {
      return sock.sendMessage(from, {
        text: `╔═══❌ *REGISTRO INCOMPLETO* ❌═══
║
║ 📝 *Uso correcto:*
║ ${botConfig.prefix}registrar nombre|password
║
║ 📌 *Ejemplo:*
║ ${botConfig.prefix}registrar Carlos|12345
║
╚══════════════════════╝`
      }, { quoted: msg });
    }

    const [nombre, password] = input;
    const userId = sender;

    const existente = await User.findOne({ numero: userId });
    if (existente) {
      const numeroLimpio = userId.split('@')[0];
      return sock.sendMessage(from, { text: `❌ Ya estás registrado con el número *${numeroLimpio}*.` }, { quoted: msg });
    }

    const fechaRegistro = new Date().toLocaleDateString('es-PE');

    await User.create({
      numero: userId,
      nombre,
      password,
      creditos: 1,
      fecha: fechaRegistro
    });

    const menuUsuario = `
╔═════👤 **PERFIL DE USUARIO** 👤═════
║ 
║ 👤 **Nombre:** ${nombre}
║ 💰 **Créditos:** 1
║ 📅 **Registro:** ${fechaRegistro}
║ 
╚══════════════════════════════════╝
¡Registro completado con éxito! Ahora tienes 1 crédito disponible.`;

    sock.sendMessage(from, { text: menuUsuario });
  }
}
