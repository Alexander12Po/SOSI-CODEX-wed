/**
 * Plugin: Remover fondo de imagen (Background Remover)
 * ────────────────────────────────────────────────────
 * Comando: .removebg <link de imagen>  (también: .rmbg, .nobg)
 * Envía la imagen resultante sin fondo (PNG transparente).
 */

import axios from 'axios';
import FormData from 'form-data';

class BgRemover {
  constructor() {
    this.token = 'f81bc59e849e883ad50a876988956dbf';
    this.base = 'https://img.caapis.com';
    this.ax = axios.create({ headers: { 'User-Agent': 'okhttp/4.11.0' } });
  }

  async fetchUrlToBuffer(url) {
    try {
      const { data } = await this.ax.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(data);
    } catch (e) {
      throw new Error(`No se pudo descargar la imagen: ${e.message}`);
    }
  }

  async up(buffer) {
    try {
      const form = new FormData();
      form.append('file_type', 'bg_remover');
      form.append('file', buffer, { filename: 'image.jpg' });
      form.append('hash', '');

      const { data } = await this.ax.post(`${this.base}/fileupload_new`, form, { headers: form.getHeaders() });
      return data?.hash || null;
    } catch (e) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  }

  async proc(hash) {
    try {
      const form = new FormData();
      form.append('access_token', this.token);
      form.append('hash', hash);

      const { data } = await this.ax.post(`${this.base}/image_bg_remove`, form, { headers: form.getHeaders() });
      return data?.download_url || null;
    } catch (e) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  }

  async remove(imageUrl) {
    const buffer = await this.fetchUrlToBuffer(imageUrl);
    const hash = await this.up(buffer);
    if (!hash) throw new Error('No se pudo obtener el hash de subida');
    const resultUrl = await this.proc(hash);
    if (!resultUrl) throw new Error('No se pudo eliminar el fondo');
    return resultUrl;
  }
}

export default {
  command: ['removebg', 'rmbg', 'nobg'],
  cost: 2,

  async exec({ sock, msg, from, args }) {
    const imageUrl = args[0];

    if (!imageUrl || !imageUrl.startsWith('http')) {
      await sock.sendMessage(from, {
        text: '📌 Uso: *.removebg <link de imagen>*\nEjemplo: .removebg https://ejemplo.com/foto.jpg',
      }, { quoted: msg });
      return false;
    }

    try {
      await sock.sendMessage(from, { text: '⏳ Eliminando el fondo de la imagen, un momento...' }, { quoted: msg });

      const api = new BgRemover();
      const resultUrl = await api.remove(imageUrl);

      await sock.sendMessage(from, {
        image: { url: resultUrl },
        caption: '✅ Fondo eliminado correctamente.',
      }, { quoted: msg });

      return true;
    } catch (error) {
      console.error('[removebg] Error:', error.message);
      await sock.sendMessage(from, {
        text: `❌ Ocurrió un error al eliminar el fondo:\n${error.message}`,
      }, { quoted: msg });
      return false;
    }
  },
};