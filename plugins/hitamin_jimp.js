import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Jimp } from 'jimp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

export default {
  command: ['hitamin', 'negro'],
  cost: 1,
  async exec({ sock, msg, from }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMessage = quoted?.imageMessage || msg.message?.imageMessage;

    if (!imageMessage) {
      await sock.sendMessage(from, {
        text: '📸 Responde a una imagen con *.hitamin* para aplicar el filtro.'
      }, { quoted: msg });
      return false;
    }

    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});

    const inputPath = path.join(tmpDir, `hitamin_in_${Date.now()}.jpg`);
    const outputPath = path.join(tmpDir, `hitamin_out_${Date.now()}.jpg`);

    try {
      const stream = await downloadContentFromMessage(imageMessage, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      fs.writeFileSync(inputPath, buffer);

      const imagen = await Jimp.read(inputPath);
      const { width, height } = imagen.bitmap;
      const buf = imagen.bitmap.data;

      // Convierte RGB a HSL para poder filtrar por tono de piel
      function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
          h = s = 0;
        } else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }
        return [h * 360, s * 100, l * 100];
      }

      // --- Paso 1: construir máscara booleana de "es piel" ---
      let mask = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const [h, s, l] = rgbToHsl(buf[idx], buf[idx + 1], buf[idx + 2]);
          // Rango amplio: matiz cálido, cualquier saturación baja-media, luminosidad media-alta
          const esPiel = h >= 0 && h <= 50 && s <= 70 && l >= 40 && l <= 97;
          mask[y * width + x] = esPiel ? 1 : 0;
        }
      }

      // --- Paso 2: cierre morfológico (rellena huecos rodeados de piel) ---
      function dilate(src) {
        const out = new Uint8Array(src.length);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let val = 0;
            for (let dy = -1; dy <= 1 && !val; dy++) {
              for (let dx = -1; dx <= 1 && !val; dx++) {
                const ny = y + dy, nx = x + dx;
                if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                  if (src[ny * width + nx]) val = 1;
                }
              }
            }
            out[y * width + x] = val;
          }
        }
        return out;
      }

      function erode(src) {
        const out = new Uint8Array(src.length);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let val = 1;
            for (let dy = -1; dy <= 1 && val; dy++) {
              for (let dx = -1; dx <= 1 && val; dx++) {
                const ny = y + dy, nx = x + dx;
                if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                  if (!src[ny * width + nx]) val = 0;
                } else {
                  val = 0;
                }
              }
            }
            out[y * width + x] = val;
          }
        }
        return out;
      }

      // Cierre = dilatar N veces luego erosionar N veces (rellena huecos más grandes,
      // como los mechones de pelo que cruzan la frente, sin agrandar el borde real)
      const RADIO_CIERRE = 6;
      for (let i = 0; i < RADIO_CIERRE; i++) mask = dilate(mask);
      for (let i = 0; i < RADIO_CIERRE; i++) mask = erode(mask);

      // --- Paso 3: aplicar el tinte solo donde la máscara final dice "piel" ---
      const tinte = { r: 90, g: 60, b: 40 };
      const mezcla = 0.55;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!mask[y * width + x]) continue;
          const idx = (y * width + x) * 4;
          buf[idx + 0] = buf[idx + 0] * (1 - mezcla) + tinte.r * mezcla;
          buf[idx + 1] = buf[idx + 1] * (1 - mezcla) + tinte.g * mezcla;
          buf[idx + 2] = buf[idx + 2] * (1 - mezcla) + tinte.b * mezcla;
        }
      }

      await imagen.write(outputPath);

      await sock.sendMessage(from, {
        image: fs.readFileSync(outputPath),
        caption: 'done bosku ✅'
      }, { quoted: msg });

      return true;
    } catch (err) {
      console.error('Error en hitamin:', err.message);
      await sock.sendMessage(from, { text: '❌ No se pudo procesar la imagen.' }, { quoted: msg });
      return false;
    } finally {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  }
};
