export default {
  command: 'id',
  cost: 0,
  async exec({ sock, msg, from, sender }) {
    const esGrupo = from.endsWith('@g.us');

    // --- Info del remitente ---
    let texto = `🆔 *TU INFORMACIÓN*\n\n`;
    texto += `👤 Número: *${sender.split('@')[0]}*\n`;
    texto += `💬 Chat actual: *${esGrupo ? 'Grupo' : 'Privado'}*\n`;

    if (esGrupo) {
      try {
        const metadata = await sock.groupMetadata(from);
        const totalMiembros = metadata.participants.length;
        const admins = metadata.participants.filter(p => p.admin).length;
        const soyAdmin = metadata.participants.find(p => p.id === sender)?.admin;

        texto += `\n📌 *ESTE GRUPO*\n`;
        texto += `▸ Nombre: *${metadata.subject}*\n`;
        texto += `▸ ID: \`${from}\`\n`;
        texto += `▸ Miembros: *${totalMiembros}*\n`;
        texto += `▸ Admins: *${admins}*\n`;
        texto += `▸ Tu rol: *${soyAdmin ? (soyAdmin === 'superadmin' ? 'Creador' : 'Admin') : 'Miembro'}*\n`;
        if (metadata.desc) {
          texto += `▸ Descripción: _${metadata.desc.slice(0, 100)}${metadata.desc.length > 100 ? '...' : ''}_\n`;
        }
      } catch (err) {
        texto += `\n⚠️ No se pudo leer la info del grupo.\n`;
      }
    }

    // --- Todos los grupos donde está el BOT ---
    // Nota: WhatsApp no permite ver los grupos de otra persona,
    // solo se puede listar en qué grupos participa el bot.
    try {
      const todosLosGrupos = await sock.groupFetchAllParticipating();
      const listaGrupos = Object.values(todosLosGrupos);

      if (listaGrupos.length > 0) {
        texto += `\n📋 *GRUPOS DONDE ESTOY* (${listaGrupos.length})\n`;

        const ordenados = listaGrupos.sort((a, b) => b.participants.length - a.participants.length);

        ordenados.forEach((g, i) => {
          const estaElUsuario = g.participants.some(p => p.id === sender);
          const marca = estaElUsuario ? '✅' : '▫️';
          texto += `${marca} ${i + 1}. *${g.subject}* — ${g.participants.length} miembros\n`;
        });

        texto += `\n✅ = grupos donde tú también estás`;
      } else {
        texto += `\n📋 No estoy en ningún grupo todavía.`;
      }
    } catch (err) {
      texto += `\n⚠️ No se pudo obtener la lista de grupos.`;
    }

    await sock.sendMessage(from, { text: texto }, { quoted: msg });
    return true;
  }
};
