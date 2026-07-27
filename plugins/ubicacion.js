import axios from 'axios';

export default {
  command: ['ip', 'ubicacion', 'geoip'],
  cost: 1,
  exec: async ({ sock, msg, from, args }) => {
    const ip = args[0] || '';

    if (!ip) {
      await sock.sendMessage(from, {
        text: '❌ Debes indicar una IP.\nEjemplo: *.ip 8.8.8.8*'
      }, { quoted: msg });
      return false;
    }

    try {
      const { data } = await axios.get(`http://ip-api.com/json/${ip}?lang=es`);

      if (data.status === 'fail') {
        await sock.sendMessage(from, {
          text: `❌ No se pudo obtener info de esa IP: ${data.message}`
        }, { quoted: msg });
        return false;
      }

      const mapsLink = `https://www.google.com/maps?q=${data.lat},${data.lon}`;

      const respuesta = `╭══════════════════════╮
│  📍 GEOLOCALIZACIÓN IP  │
╰══════════════════════╯

🌐 *IP:* ${data.query}
🏳️ *País:* ${data.country} (${data.countryCode})
🏙️ *Región:* ${data.regionName}
🏘️ *Ciudad:* ${data.city}
📮 *Código Postal:* ${data.zip}
🕒 *Zona horaria:* ${data.timezone}
📡 *ISP:* ${data.isp}
📌 *Coordenadas:* ${data.lat}, ${data.lon}
🗺️ *Ver en mapa:* ${mapsLink}

━━━━━━━━━━━━━━━━━━
🤖 *SOSI CODEX*`;

      await sock.sendMessage(from, { text: respuesta }, { quoted: msg });

    } catch (error) {
      console.error('Error en comando ip:', error.message);
      await sock.sendMessage(from, {
        text: '⚠️ Ocurrió un error al consultar la ubicación.'
      }, { quoted: msg });
      return false;
    }
  }
};
