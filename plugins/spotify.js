/**
 * Plugin: Spotify Downloader
 * ────────────────────────────
 * Comando: .spotify <url>  (también: .spotifydl, .sp)
 * Descarga el track de Spotify y lo envía como audio al chat.
 */

import axios from 'axios';

class SpotifyDL {
  constructor() {
    this.api = {
      meta: 'https://spotify.dlapi.app/api/Gettrack',
      convert: 'https://master.dlapi.app/api/v1/convert',
      task: 'https://master.dlapi.app/api/v1/tasks',
    };
    this.client = axios.create({
      headers: {
        Authorization: 'Bearer pGLXoCsVu0hcstAecIDwlrlbcrUzv0e1cWBJ0yuB',
        'Content-Type': 'application/json',
        'User-Agent': 'Spotmate/1.0',
      },
    });
  }

  valid(url) {
    return /^(https?:\/\/)?(open\.)?spotify\.com\/(track|album|playlist|artist)\/[a-zA-Z0-9]+/.test(url);
  }

  async meta(url) {
    const { data } = await this.client.get(this.api.meta, { params: { spotify_url: url } });
    if (!data) throw new Error('API Data Empty');
    return data;
  }

  async convert(url, format = 'mp3') {
    const { data: init } = await this.client.post(this.api.convert, { url, format });
    if (init?.download_url) return init.download_url;

    const taskId = init?.task_id || init?.id;
    if (!taskId) throw new Error('No Task ID received');

    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const { data: status } = await this.client.get(`${this.api.task}/${taskId}`);
      if (status?.status === 'finished' || status?.status === 'completed') {
        return status?.result?.download_url || status?.download_url;
      }
      if (status?.status === 'failed') throw new Error('Server-side processing failed');
    }
    throw new Error('Task Timeout');
  }

  async download({ url, format = 'mp3' }) {
    if (!this.valid(url)) throw new Error('URL de Spotify inválida');
    const data = await this.meta(url);
    const targetUrl = data?.external_urls?.spotify || url;
    const downloadUrl = await this.convert(targetUrl, format);
    return {
      title: data.name,
      artist: data.artists?.map((a) => a.name).join(', '),
      album: data.album?.name,
      duration: data.duration_ms,
      cover: data.album?.images?.[0]?.url,
      download: downloadUrl,
    };
  }
}

export default {
  command: ['spotify', 'spotifydl', 'sp'],
  cost: 2,

  async exec({ sock, msg, from, args }) {
    const url = args[0];

    if (!url) {
      await sock.sendMessage(from, {
        text: '📌 Uso: *.spotify <link de spotify>*\nEjemplo: .spotify https://open.spotify.com/track/xxxxx',
      }, { quoted: msg });
      return false;
    }

    const api = new SpotifyDL();

    if (!api.valid(url)) {
      await sock.sendMessage(from, { text: '❌ Ese no es un link válido de Spotify (track/album/playlist/artist).' }, { quoted: msg });
      return false;
    }

    try {
      await sock.sendMessage(from, { text: '⏳ Buscando y descargando el track, un momento...' }, { quoted: msg });

      const result = await api.download({ url });

      if (!result.download) {
        throw new Error('No se obtuvo el link de descarga final');
      }

      const durationMin = result.duration ? Math.floor(result.duration / 60000) : 0;
      const durationSec = result.duration ? Math.floor((result.duration % 60000) / 1000) : 0;

      const caption = `🎵 *${result.title}*\n👤 ${result.artist || 'Desconocido'}\n💿 ${result.album || '-'}\n⏱️ ${durationMin}:${String(durationSec).padStart(2, '0')}`;

      if (result.cover) {
        await sock.sendMessage(from, { image: { url: result.cover }, caption }, { quoted: msg });
      }

      const audioRes = await axios.get(result.download, { responseType: 'arraybuffer', timeout: 60000 });
      const audioBuffer = Buffer.from(audioRes.data);

      await sock.sendMessage(from, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${result.title || 'track'}.mp3`,
      }, { quoted: msg });

      return true;
    } catch (error) {
      console.error('[spotify] Error:', error.message);
      await sock.sendMessage(from, {
        text: `❌ Ocurrió un error al descargar de Spotify:\n${error.message}`,
      }, { quoted: msg });
      return false;
    }
  },
};