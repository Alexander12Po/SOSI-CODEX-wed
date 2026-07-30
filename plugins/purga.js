export default {
  command: ['purga', 'kill', 'sosi', 'purge'],
  exec: async ({ sock, msg, from }) => {
    // Verificar que sea un grupo
    if (!from.endsWith('@g.us')) {
      return sock.sendMessage(from, {
        text: '❌ Este comando solo funciona dentro de un grupo.'
      }, { quoted: msg });
    }

    const metadata = await sock.groupMetadata(from);
    const botId = sock.user.id.split(':')[0]; // Tu número sin @
    const botJid = botId + '@s.whatsapp.net';

    // 🔍 DEBUG - quitar después de diagnosticar
    console.log('sock.user.id:', sock.user.id);
    console.log('participantes:', JSON.stringify(metadata.participants, null, 2));

    // Verificar que TÚ (el número del bot) seas admin del grupo
    const tuEresAdmin = metadata.participants.some(p => {
      const participantId = p.id.split('@')[0].split(':')[0];
      return participantId === botId && (p.admin === 'admin' || p.admin === 'superadmin');
    });

    if (!tuEresAdmin) {
      return sock.sendMessage(from, {
        text: '❌ Necesitas ser administrador del grupo para usar este comando.'
      }, { quoted: msg });
    }

    // Lista de participantes, excluyendo al bot y a los admins reales
    const participantes = metadata.participants
      .map(p => p.id)
      .filter(id =>
        id !== botJid &&
        !metadata.participants.find(p => p.id === id && (p.admin === 'admin' || p.admin === 'superadmin'))
      );

    await sock.sendMessage(from, {
      text: `⚠️ Iniciando purga de *${participantes.length}* miembros. Esto tomará aproximadamente ${Math.ceil((participantes.length / 20) * 0.5)} segundos...`
    }, { quoted: msg });

    const tamañoLote = 20;
    const pausaMs = 500;
    let eliminados = 0;

    for (let i = 0; i < participantes.length; i += tamañoLote) {
      const lote = participantes.slice(i, i + tamañoLote);
      try {
        await sock.groupParticipantsUpdate(from, lote, 'remove');
        eliminados += lote.length;
      } catch (err) {
        console.log('Error eliminando lote:', err.message);
      }
      await new Promise(resolve => setTimeout(resolve, pausaMs));
    }

    return sock.sendMessage(from, {
      text: `✅ Purga completada. *${eliminados}* miembros eliminados.`
    });
  }
};