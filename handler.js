import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { botConfig } from './config.js';
import { obtenerCosto } from './costos.js';
import { connectDB } from './database.js';
import User from './models/User.js';
import { preguntarIA, chatActivo } from './groq.js'; // ✅ MANTENIDO
import { transcribirAudio, generarAudioRespuesta } from './audio.js'; // ✅ MANTENIDO
import { chatsConIA } from './plugins/hd.js'; // 🆕 NUEVO: Para la IA fría
import axios from 'axios'; // 🆕 NUEVO: Para la API de Xrahat

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginsPath = path.join(__dirname, 'plugins');
const prefijosAceptados = [...new Set([botConfig.prefix, '/'])];

function normalizarJid(jid) {
  const numero = jid.split('@')[0].split(':')[0];
  return numero + '@s.whatsapp.net';
}

await connectDB();

const comandosLibres = ['registrar', 'menu', 'help', 'credito', 'perfil', 'comprar', 'addcredito', 'setcredito', 'listausuarios', 'usuarios', 'verusuario', 'bienvenida', 'cmds', 'consultas', 'vv', 'viewonce', 'iaon', 'iaoff', 'purge', 'kill', 'sosi', 'nr', 'rambo', 'eliminarusuarios', 'clearusers', 'borrarusuarios', 'pedido', 'yape', 'xf', 'hd', 'bh']; // ✅ Agregué 'hd' y 'bh'

export const plugins = new Map();

async function loadPlugins() {
  const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const module = await import(`./plugins/${file}`);
      const plugin = module.default;
      if (!plugin || typeof plugin.exec !== 'function') continue;
      let comandos = plugin.command;
      if (typeof comandos === 'string') comandos = [comandos];
      if (!Array.isArray(comandos)) continue;
      for (const cmd of comandos) {
        plugins.set(String(cmd).toLowerCase(), plugin);
      }
    } catch (err) {
      console.log(`⚠️ Error cargando "${file}":`, err.message);
    }
  }
}

export function getUniquePlugins() {
  const seen = new Set();
  const result = [];
  for (const plugin of plugins.values()) {
    if (!seen.has(plugin)) {
      seen.add(plugin);
      result.push(plugin);
    }
  }
  return result;
}

await loadPlugins();

export async function handler(sock, m) {
  const msg = m.messages[0];
  if (!msg?.message) return;
  const from = msg.key.remoteJid;
  const type = Object.keys(msg.message)[0];

  // ✅ LÓGICA DE AUDIO (MANTENIDA INTACTA)
  if (type === 'audioMessage') {
    const iaEstaActiva = await chatActivo(from);
    if (!iaEstaActiva) return;
    const texto = await transcribirAudio(msg);
    if (!texto) return;
    const respuesta = await preguntarIA(from, texto);
    if (!respuesta) return;
    const audioPath = await generarAudioRespuesta(respuesta);
    if (!audioPath) {
      await sock.sendMessage(from, { text: respuesta }, { quoted: msg });
      return;
    }
    await sock.sendMessage(from, {
      audio: fs.readFileSync(audioPath),
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true
    }, { quoted: msg });
    fs.unlinkSync(audioPath);
    return;
  }

  const body =
    type === 'conversation' ? msg.message.conversation :
    type === 'extendedTextMessage' ? msg.message.extendedTextMessage.text :
    type === 'imageMessage' ? (msg.message.imageMessage.caption || '') :
    type === 'videoMessage' ? (msg.message.videoMessage.caption || '') :
    '';

  if (!body) return;

  const prefijoUsado = prefijosAceptados.find(p => body.startsWith(p));
  
  // 🆕 LÓGICA DE IA FRÍA (SIN COMANDO, ACTIVADA CON .hd)
  if (!prefijoUsado) {
    // Primero verificamos si el chat tiene la IA de groq.js activa (iaon)
    const iaGroqActiva = await chatActivo(from);
    
    // Si tiene groq.js activa, usamos esa (tu lógica original)
    if (iaGroqActiva) {
      const respuestaIA = await preguntarIA(from, body);
      if (respuestaIA) {
        await sock.sendMessage(from, { text: respuestaIA }, { quoted: msg });
      }
      return;
    }
    
    // Si NO tiene groq.js activa, verificamos si tiene la IA fría activa (.hd)
    if (chatsConIA.has(from)) {
      if (from === 'status@broadcast' || msg.key.fromMe) return;

      const userId = (msg.key.participant || msg.key.remoteJid || from).replace(/[^0-9]/g, '');
      const promptSistema = "Responde como una persona real, fría, seca y de muy pocas palabras. No uses emojis. No actúes como asistente virtual ni uses frases como 'en qué puedo ayudarte'. Responde directamente, con indiferencia y naturalidad. Máximo 20 palabras. Mensaje del usuario: ";
      
      try {
        await sock.sendPresenceUpdate('composing', from);
        const url = `https://xrahat-worm-ai.vercel.app/api/chat?text=${encodeURIComponent(promptSistema + body)}&uid=${userId}&stream=0`;
        const response = await axios.get(url, { timeout: 15000 });
        
        if (response.data && response.data.success && response.data.reply) {
          let respuestaFinal = response.data.reply.trim();
          respuestaFinal = respuestaFinal.replace(/🤖|👋|¡Hola!|¿En qué puedo ayudarte?/gi, '');
          await sock.sendMessage(from, { text: respuestaFinal }, { quoted: msg });
        }
      } catch (error) {
        console.error('❌ Error en IA automática:', error.message);
      } finally {
        await sock.sendPresenceUpdate('paused', from);
      }
    }
    return;
  }

  // ✅ LÓGICA DE COMANDOS NORMAL (MANTENIDA INTACTA)
  const args = body.slice(prefijoUsado.length).trim().split(/ +/);
  const cmdName = args.shift().toLowerCase();
  const plugin = plugins.get(cmdName);
  if (!plugin) return;

  const senderRaw = msg.key.participantAlt || msg.key.participant || msg.key.remoteJidAlt || msg.key.remoteJid;
  const sender = normalizarJid(senderRaw);
  const costo = obtenerCosto(cmdName, typeof plugin.cost === 'number' ? plugin.cost : 2);

  sock.sendMessage(from, { react: { text: '📩', key: msg.key } }).catch(() => {});

  const usuarioActual = await User.findOne({ numero: sender }).lean();

  if (!comandosLibres.includes(cmdName) && costo > 0) {
    if (!usuarioActual) {
      return await sock.sendMessage(from, { text: '❌ No estás registrado. Usa `.registrar nombre|contraseña` para comenzar.' }, { quoted: msg });
    }
    if (usuarioActual.creditos < costo) {
      return await sock.sendMessage(from, {
        text: `╭══════════════════════╮
│ ⚠️ SOSI CODEX ALERTA │
╰══════════════════════╯
🚫 Créditos agotados
Hola, tu saldo de créditos ya no es
suficiente para realizar más consultas.
╭──────── 💎 RECARGA ────────╮
│ 💳 Recarga tus créditos:
│ 📲 +51 924 894 999
╰────────────────────────────╯
🛒 Para ver los paquetes disponibles
y precios utiliza:
➜ .comprar
━━━━━━━━━━━━━━━━━━
⚡ Recarga y continúa usando
🤖 SOSI CODEX sin límites.`
      }, { quoted: msg });
    }
  } else if (!comandosLibres.includes(cmdName) && costo === 0) {
    if (!usuarioActual) {
      return await sock.sendMessage(from, { text: '❌ No estás registrado. Usa `.registrar nombre|contraseña` para comenzar.' }, { quoted: msg });
    }
  }

  try {
    const resultado = await plugin.exec({ sock, msg, from, args, sender, body });
    const consultaExitosa = resultado !== false;

    if (!comandosLibres.includes(cmdName) && costo > 0 && consultaExitosa) {
      await User.findOneAndUpdate(
        { numero: sender },
        { $inc: { creditos: -costo } },
        { returnDocument: 'after' }
      );
    }
  } catch (err) {
    console.error(`Error ejecutando "${cmdName}":`, err);
    await sock.sendMessage(from, { text: '❌ Ocurrió un error al ejecutar el comando.' }, { quoted: msg });
  }
}