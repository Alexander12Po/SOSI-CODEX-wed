/**
 * Plugin: Upscale de imagen (Visual Paradigm AI)
 * ────────────────────────────────────────────────
 * Comando: .upscale / .hd / .enhance
 * Uso: enviar una imagen con el comando en el caption,
 *      o responder (reply) a una imagen con el comando.
 * Resultado: se sube a uguu.se y se envía la imagen mejorada.
 *
 * Credit: febry.is-a.dev | github.com/vandebry10-star
 * DO NOT REMOVE THIS CREDIT
 */

import axios from 'axios';
import FormData from 'form-data';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const CREDIT = 'febry.is-a.dev | github.com/vandebry10-star | DO NOT REMOVE THIS CREDIT';

async function bufferFromMediaMessage(mediaMsg, type) {
  const stream = await downloadContentFromMessage(mediaMsg, type);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

function detectExt(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0x52 && buf[1] === 0x49) return 'webp';
  return 'jpg';
}

async function upscaleImage(buffer) {
  const form = new FormData();
  form.append('file', buffer, {
    filename: 'image.' + detectExt(buffer),
    contentType: 'image/' + detectExt(buffer),
  });

  const res = await axios.post(
    'https://ai-services.visual-paradigm.com/api/super-resolution/file',
    form,
    {
      headers: { ...form.getHeaders(), accept: '*/*' },
      responseType: 'arraybuffer',
      timeout: 30000,
    }
  );

  return Buffer.from(res.data);
}

async function uploadToUguu(buffer) {
  const ext = detectExt(buffer);
  const form = new FormData();
  form.append('files[]', buffer, { filename: `upscaled_${Date.now()}.${ext}` });

  const res = await axios.post('https://uguu.se/upload', form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });

  if (!res.data.success) throw new Error('Upload a uguu.se falló');
  return res.data.files[0];
}

export default {
  command: ['upscale', 'hd', 'enhance'],
  cost: 3,

  async exec({ sock, msg, from, args }) {
    try {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quotedImage = contextInfo?.quotedMessage?.imageMessage;
      const directImage = msg.message?.imageMessage;

      const imageMsg = directImage || quotedImage;

      if (!imageMsg) {
        await sock.sendMessage(from, {
          text: '📌 Envía una imagen con el comando *.upscale* en el texto, o responde a una imagen con ese comando.',
        }, { quoted: msg });
        return false;
      }

      await sock.sendMessage(from, { text: '⏳ Mejorando resolución de la imagen, un momento...' }, { quoted: msg });

      const buffer = await bufferFromMediaMessage(imageMsg, 'image');
      const upscaled = await upscaleImage(buffer);
      const uploaded = await uploadToUguu(upscaled);

      await sock.sendMessage(from, {
        image: { url: uploaded.url },
        caption: `✅ *Imagen mejorada*\n\n🔗 ${uploaded.url}\n\n_${CREDIT}_`,
      }, { quoted: msg });

      return true;
    } catch (error) {
      console.error('[upscale] Error:', error.message);
      await sock.sendMessage(from, {
        text: `❌ Ocurrió un error al mejorar la imagen:\n${error.message}`,
      }, { quoted: msg });
      return false;
    }
  },
};