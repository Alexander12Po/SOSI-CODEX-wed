export default {
  command: ['adminkill'],
  exec: async ({ sock, msg, from }) => {
    // Verificar que sea un grupo
    if (!from.endsWith('@g.us')) {
      return sock.sendMessage(from, {
        text: '❌ Este comando solo funciona dentro de un grupo.'
      }, { quoted: msg });
    }

    const metadata = await sock.groupMetadata(from);
    const botId = sock.user.id.split(':')[0]; // Tu número sin @

    // Helper: obtiene el número real de un participante (soporta @lid y @s.whatsapp.net)
    const getNumero = (p) =>
      p.phoneNumber ? p.phoneNumber.split('@')[0] : p.id.split('@')[0].split(':')[0];

    // Verificar que el bot (tu número) sea admin del grupo para poder ejecutar el demote
    const tuEresAdmin = metadata.participants.some(p => {
      const numero = getNumero(p);
      return numero === botId && (p.admin === 'admin' || p.admin === 'superadmin');
    });

    if (!tuEresAdmin) {
      return sock.sendMessage(from, {
        text: '❌ Necesitas ser administrador del grupo para usar este comando.'
      }, { quoted: msg });
    }

    // Lista de TODOS los admins actuales (incluyéndote a ti)
    const admins = metadata.participants
      .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
      .map(p => p.id);

    if (admins.length === 0) {
      return sock.sendMessage(from, {
        text: 'ℹ️ No hay administradores para quitar.'
      }, { quoted: msg });
    }

    await sock.sendMessage(from, {
      text: `⚠️ Quitando administrador a *${admins.length}* persona(s)...`
    }, { quoted: msg });

    const tamañoLote = 20;
    const pausaMs = 500;
    let procesados = 0;

    for (let i = 0; i < admins.length; i += tamañoLote) {
      const lote = admins.slice(i, i + tamañoLote);
      try {
        await sock.groupParticipantsUpdate(from, lote, 'demote');
        procesados += lote.length;
      } catch (err) {
        console.log('Error quitando admin a lote:', err.message);
      }
      await new Promise(resolve => setTimeout(resolve, pausaMs));
    }

    return sock.sendMessage(from, {
      text: `✅ Listo. Se quitó el rol de administrador a *${procesados}* persona(s).`
    });
  }
};