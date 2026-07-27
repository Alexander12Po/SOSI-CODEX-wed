// plugins/descargarrepo.js
import axios from 'axios';

export default {
  command: ['zip', 'descargarrepo', 'gitzip'],
  cost: 2,
  exec: async ({ sock, msg, from, args }) => {
    const url = args[0] || '';

    if (!url || !url.includes('github.com')) {
      await sock.sendMessage(from, {
        text: '❌ Debes enviar un enlace válido de GitHub.\nEjemplo: *.zip https://github.com/usuario/repositorio*'
      }, { quoted: msg });
      return false;
    }

    try {
      // Limpiar la URL y extraer usuario/repo
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        await sock.sendMessage(from, { text: '❌ No pude interpretar ese enlace de GitHub.' }, { quoted: msg });
        return false;
      }

      const usuario = match[1];
      const repo = match[2].replace('.git', '').replace(/\/$/, '');

      await sock.sendMessage(from, { text: '⏳ Descargando repositorio, espera un momento...' }, { quoted: msg });

      // Intentar con la rama "main" primero, si falla probar "master"
      const ramas = ['main', 'master'];
      let zipBuffer = null;
      let ramaUsada = '';

      for (const rama of ramas) {
        try {
          const zipUrl = `https://github.com/${usuario}/${repo}/archive/refs/heads/${rama}.zip`;
          const response = await axios.get(zipUrl, { responseType: 'arraybuffer' });
          zipBuffer = Buffer.from(response.data);
          ramaUsada = rama;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!zipBuffer) {
        await sock.sendMessage(from, { text: '❌ No se pudo descargar el repositorio. Verifica que el enlace sea correcto y público.' }, { quoted: msg });
        return false;
      }

      await sock.sendMessage(from, {
        document: zipBuffer,
        fileName: `${repo}-${ramaUsada}.zip`,
        mimetype: 'application/zip',
        caption: `📦 *${repo}*\n🌿 Rama: ${ramaUsada}\n👤 Autor: ${usuario}`
      }, { quoted: msg });

    } catch (error) {
      console.error('Error en descargarrepo:', error.message);
      await sock.sendMessage(from, { text: '⚠️ Ocurrió un error al descargar el repositorio.' }, { quoted: msg });
      return false;
    }
  }
};