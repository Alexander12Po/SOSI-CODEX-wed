export default {
  command: 'ping',
  cost: 0,
  async exec({ sock, msg, from }) {
    const inicio = Date.now();

    // Mensaje inicial para poder editarlo/calcular el tiempo real de ida y vuelta
    const sent = await sock.sendMessage(from, { text: '🏓 Calculando...' }, { quoted: msg });

    const latenciaMs = Date.now() - inicio;

    // Clasificación simple del estado de conexión
    let estado;
    let emoji;
    if (latenciaMs < 300) {
      estado = 'Excelente';
      emoji = '🟢';
    } else if (latenciaMs < 800) {
      estado = 'Buena';
      emoji = '🟡';
    } else if (latenciaMs < 1500) {
      estado = 'Regular';
      emoji = '🟠';
    } else {
      estado = 'Lenta';
      emoji = '🔴';
    }

    const uptimeSegundos = process.uptime();
    const horas = Math.floor(uptimeSegundos / 3600);
    const minutos = Math.floor((uptimeSegundos % 3600) / 60);
    const segundos = Math.floor(uptimeSegundos % 60);

    const texto = `🏓 *PONG*

⚡ Velocidad: *${latenciaMs}ms*
${emoji} Estado: *${estado}*
🕐 Uptime: *${horas}h ${minutos}m ${segundos}s*`;

    await sock.sendMessage(from, { text: texto, edit: sent.key }, { quoted: msg }).catch(async () => {
      // Si el proveedor no soporta editar mensajes, envía uno nuevo
      await sock.sendMessage(from, { text: texto }, { quoted: msg });
    });

    return true;
  }
};
