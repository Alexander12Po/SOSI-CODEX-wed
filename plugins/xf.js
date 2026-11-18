// plugins/xf.js
// Todos los usuarios pueden usarlo y todo se sube a los estados del bot (tu cuenta).
//   .xf 10 hola me gusta el limón        -> estados de texto
//   (imagen o video con pie) .xf 5 texto -> ese archivo como estado
//   (responder a imagen o video) .xf 3 texto
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import User from '../models/User.js';

// ================== CONFIGURACIÓN ==================
const DUEÑOS = ['51924894999'];          // sin límites (solo dígitos, con código de país)
const REQUERIR_REGISTRO = true;          // los demás deben estar registrados (.registrar)
const MAX_DUEÑO = 20;                    // máximo de estados por comando para ti
const MAX_OTROS = 3;                     // máximo de estados por comando para los demás
const ESPERA_OTROS_SEG = 60;             // segundos de espera entre usos para los demás
const MAX_TEXTO = 700;                   // largo máximo del texto
const VER_USUARIOS_REGISTRADOS = true;   // quién ve el estado: tú + usuarios registrados del bot
const CONTACTOS_EXTRA = [];              // más personas, ej: '51999999999@s.whatsapp.net'
const PAUSA_MS = 2000;                   // pausa entre un estado y otro
const COLORES = ['#2e7d32', '#1565c0', '#6a1b9a', '#c62828', '#ef6c00', '#00838f'];
// ===================================================

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const ultimoUso = new Map();

async function listaDestinatarios(sock) {
  const yo = sock.user.id.split(':')[0].split('@')[0] + '@s.whatsapp.net';
  const lista = new Set([yo, ...CONTACTOS_EXTRA]);
  if (VER_USUARIOS_REGISTRADOS) {
    try {
      const usuarios = await User.find({}, { numero: 1, _id: 0 }).lean();
      for (const u of usuarios) if (u.numero) lista.add(u.numero);
    } catch (e) {
      console.error('xf: no pude leer los usuarios', e.message);
    }
  }
  return [...lista];
}

export default {
  command: ['xf'],
  cost: 0,

  async exec({ sock, msg, from, args, sender }) {
    const responder = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });
    const numero = sender.split('@')[0];
    const esDueño = !!msg.key.fromMe || DUEÑOS.includes(numero);

    // Reglas para los demás usuarios
    if (!esDueño) {
      if (REQUERIR_REGISTRO) {
        const reg = await User.findOne({ numero: sender }).lean();
        if (!reg) {
          await responder('❌ Para usar .xf primero regístrate con `.registrar nombre|contraseña`');
          return false;
        }
      }
      const falta = Math.ceil(((ultimoUso.get(numero) || 0) + ESPERA_OTROS_SEG * 1000 - Date.now()) / 1000);
      if (falta > 0) {
        await responder(`⏳ Espera ${falta}s antes de usar .xf otra vez.`);
        return false;
      }
    }

    // Cantidad = primer argumento si es número; si no, 1
    let pedida = 1;
    if (args.length && /^\d+$/.test(args[0])) {
      pedida = parseInt(args.shift(), 10);
    }
    const maximo = esDueño ? MAX_DUEÑO : MAX_OTROS;
    const cantidad = Math.min(Math.max(pedida, 1), maximo);
    const texto = args.join(' ').trim().slice(0, MAX_TEXTO);

    // ¿Hay imagen o video? (en el mismo mensaje o respondiendo a uno)
    const m = msg.message;
    const ctx = m?.extendedTextMessage?.contextInfo;
    const imgPropia = m?.imageMessage;
    const vidPropio = m?.videoMessage;
    const imgCitada = ctx?.quotedMessage?.imageMessage;
    const vidCitado = ctx?.quotedMessage?.videoMessage;
    const esVideo = !!(vidPropio || (!imgPropia && vidCitado));

    let buffer = null;
    try {
      if (imgPropia || vidPropio) {
        buffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
      } else if (imgCitada || vidCitado) {
        const citado = {
          key: { remoteJid: from, id: ctx.stanzaId, participant: ctx.participant },
          message: ctx.quotedMessage,
        };
        buffer = await downloadMediaMessage(citado, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
      }
    } catch (e) {
      console.error('xf: error bajando archivo', e);
      await responder('❌ No pude descargar el archivo.');
      return false;
    }

    if (!buffer && !texto) {
      await responder('Uso: .xf 3 tu texto\nPuedes mandar una imagen o video con ese pie, o responder a una imagen o video.');
      return false;
    }

    if (!esDueño) ultimoUso.set(numero, Date.now());
    console.log(`xf: ${numero} sube ${cantidad} estado(s)${buffer ? (esVideo ? ' [video]' : ' [imagen]') : ''}: ${texto.slice(0, 60)}`);

    const statusJidList = await listaDestinatarios(sock);
    const aviso = pedida > cantidad ? ` (el máximo por comando es ${maximo})` : '';
    await responder(`⏳ Subiendo ${cantidad} estado(s)${aviso}...`);

    let subidos = 0;
    for (let i = 0; i < cantidad; i++) {
      try {
        if (buffer) {
          const contenido = esVideo
            ? { video: buffer, caption: texto, mimetype: 'video/mp4' }
            : { image: buffer, caption: texto };
          await sock.sendMessage('status@broadcast', contenido, { statusJidList });
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

    await responder(`✅ Listo: ${subidos}/${cantidad} estados subidos.`);
  },
};
