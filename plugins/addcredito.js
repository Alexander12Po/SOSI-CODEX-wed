import { botConfig } from '../config.js';
import User from '../models/User.js';

export default {
  command: ['addcredito', 'setcredito'],
  description: 'Admin: agrega o quita créditos a un usuario',
  exec: async ({ sock, from, msg, args, sender }) => {
    // Solo administradores pueden usar este comando
    if (!botConfig.admins.includes(sender)) {
      return sock.sendMessage(from, {
        text: `❌ No tienes permiso para usar este comando.\n\n🔍 Tu ID detectado por el bot es:\n${sender}\n\n📋 IDs autorizados actualmente:\n${botConfig.admins.join('\n')}`
      }, { quoted: msg });
    }

    // Uso: .addcredito nombre cantidad
    if (args.length < 2) {
      return sock.sendMessage(from, { text: 'Uso correcto: .addcredito nombre cantidad\n\nEjemplo: .addcredito Carlos 5' }, { quoted: msg });
    }

    const cantidadStr = args[args.length - 1];
    const nombreObjetivo = args.slice(0, -1).join(' ');
    const cantidad = parseInt(cantidadStr, 10);

    if (isNaN(cantidad)) {
      return sock.sendMessage(from, { text: '❌ La cantidad debe ser un número.' }, { quoted: msg });
    }

    // Búsqueda de nombre sin importar mayúsculas/minúsculas
    const usuario = await User.findOne({ nombre: { $regex: `^${nombreObjetivo}$`, $options: 'i' } });

    if (!usuario) {
      return sock.sendMessage(from, { text: `❌ No se encontró ningún usuario registrado con el nombre "${nombreObjetivo}".` }, { quoted: msg });
    }

    let nuevosCreditos = usuario.creditos + cantidad;
    if (nuevosCreditos < 0) nuevosCreditos = 0;

    const usuarioActualizado = await User.findOneAndUpdate(
      { _id: usuario._id },
      { creditos: nuevosCreditos },
      { new: true }
    );

    sock.sendMessage(from, {
      text: `✅ Créditos actualizados.\n👤 Usuario: ${usuarioActualizado.nombre}\n💰 Créditos actuales: ${usuarioActualizado.creditos}`
    }, { quoted: msg });
  }
}
