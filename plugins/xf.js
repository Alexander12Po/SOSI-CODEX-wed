// plugins/xf.js
// Uso:
//   .xf 10 hola me gusta el limón        -> 10 estados de texto
//   (imagen con pie) .xf 5 mi texto      -> 5 estados con la imagen
//   (responder a una imagen) .xf 3 texto -> 3 estados con esa imagen
import { downloadMediaMessage } from '@whiskeysockets/baileys'; // si tu paquete se llama "baileys", cámbialo aquí

// Números que pueden usar el comando (solo dígitos, con código de país)
const DUEÑOS = ['51924894999'];

const MAX_ESTADOS = 20;
const PAUSA_MS = 2000;
const COLORES = ['#2e7d32', '#1565c0', '#6a1b9a', '#c62828', '#ef6c00', '#00838f'];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export default {
  command: ['xf'],
  cost: 0,

  async exec({ sock, msg, from, args, sender }) {
    // Solo el dueño (o el propio número del bot)
    const numero = sender.split('@')[0];
    if (!msg.key.fromMe && !DUEÑOS.includes(numero)) {
      await sock.sendMessage(from, { text: '❌ Este comando es solo para el dueño.' }, { quoted: msg });
      return false;
    }

    // Cantidad = primer argumento si es número; si no, 1
    let cantidad = 1;
    if (args.length && /^\d+$/.test(args[0])) {
      cantidad = parseInt(args.shift(), 10);
    }
    cantidad = Math.min(Math.max(cantidad, 1), MAX_ESTADOS);
    const texto = args.join(' ').trim();

    // ¿Hay imagen? (en el mismo mensaje o respondiendo a una)
    const m = msg.message;
    const ctx = m?.extendedTextMessage?.contextInfo;
    const imgPropia = m?.imageMessage;
    const imgCitada = ctx?.quotedMessage?.imageMessage;

    let buffer = null;
    try {
      if (imgPropia) {
        buffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
      } else if (imgCitada) {
        const citado = {
          key: { remoteJid: from, id: ctx.stanzaId, participant: ctx.participant },
          message: ctx.quotedMessage,
        };
        buffer = await downloadMediaMessage(citado, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
      }
    } catch (e) {
      console.error('xf: error bajando imagen', e);
      await sock.sendMessage(from, { text: '❌ No pude descargar la imagen.' }, { quoted: msg });
      return false;
    }

    if (!buffer && !texto) {
      await sock.sendMessage(from, { text: 'Uso: .xf 10 tu texto\nPuedes mandar una imagen con ese pie, o responder a una imagen.' }, { quoted: msg });
      return false;
    }

    // Quién ve el estado: tú (agrega más JIDs aquí si quieres)
    const yo = sock.user.id.split(':')[0].split('@')[0] + '@s.whatsapp.net';
    const statusJidList = [yo];

    await sock.sendMessage(from, { text: `⏳ Subiendo ${cantidad} estado(s)...` }, { quoted: msg });

    let subidos = 0;
    for (let i = 0; i < cantidad; i++) {
      try {
        if (buffer) {
          await sock.sendMessage('status@broadcast', { image: buffer, caption: texto }, { statusJidList });
        } else {
          await sock.sendMessage(
            'status@broadcast',
            { text: texto, backgroundColor: COLORES[i % COLORES.length], font: 3 },
            { statusJidList }
          );
        }
        subidos++;
      } catch (e) {
        console.error('xf: error subiendo estado', e);
        break;
      }
      if (i < cantidad - 1) await dormir(PAUSA_MS);
    }

    await sock.sendMessage(from, { text: `✅ Listo: ${subidos}/${cantidad} estados subidos.` }, { quoted: msg });
  },
};
