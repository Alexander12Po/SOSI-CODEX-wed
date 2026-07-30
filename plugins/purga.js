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

    // Verificar que el bot sea admin del grupo
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const botEsAdmin = metadata.participants.some(
      p => p.id.split('@')[0] === botJid.split('@')[0] && (p.admin === 'admin' || p.admin === 'superadmin')
    );

    if (!botEsAdmin) {
      return sock.sendMessage(from, {
        text: '❌ El bot necesita ser administrador del grupo para hacer esto.'
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