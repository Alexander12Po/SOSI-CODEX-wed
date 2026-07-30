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

    // Helper: obtiene el número real de un participante (soporta @lid y @s.whatsapp.net)
    const getNumero = (p) =>
      p.phoneNumber ? p.phoneNumber.split('@')[0] : p.id.split('@')[0].split(':')[0];

    // Verificar que TÚ (el número del bot) seas admin del grupo
    const tuEresAdmin = metadata.participants.some(p => {
      const numero = getNumero(p);
      return numero === botId && (p.admin === 'admin' || p.admin === 'superadmin');
    });

    if (!tuEresAdmin) {
      return sock.sendMessage(from, {
        text: '❌ Necesitas ser administrador del grupo para usar este comando.'
      }, { quoted: msg });
    }

    // Lista de participantes: TODOS menos tú (incluye admins y miembros normales)
    const participantes = metadata.participants
      .filter(p => getNumero(p) !== botId)
      .map(p => p.id);

    await sock.sendMessage(from, {
      text: `⚠️ Iniciando purga total de *${participantes.length}* miembros (incluyendo administradores). Esto tomará aproximadamente ${Math.ceil((participantes.length / 20) * 0.5)} segundos...`
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
      text: `✅ Purga total completada. *${eliminados}* miembros eliminados.`
    });
  }
};