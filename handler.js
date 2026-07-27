import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { botConfig } from './config.js';
import { obtenerCosto } from './costos.js';
import { connectDB } from './database.js';
import User from './models/User.js';
import { preguntarIA, chatActivo } from './groq.js';
import { transcribirAudio, generarAudioRespuesta } from './audio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginsPath = path.join(__dirname, 'plugins');

function normalizarJid(jid) {
  const numero = jid.split('@')[0].split(':')[0];
  return numero + '@s.whatsapp.net';
}

console.log('🔎 [handler.js] Conectando a MongoDB...');
await connectDB();
console.log('🔎 [handler.js] MongoDB OK. Iniciando carga de plugins...');

const comandosLibres = ['registrar', 'menu', 'help', 'credito', 'perfil', 'comprar', 'addcredito', 'setcredito', 'listausuarios', 'usuarios', 'verusuario', 'bienvenida', 'cmds', 'consultas', 'vv', 'viewonce', 'iaon', 'iaoff'];

export const plugins = new Map();

async function loadPlugins() {
  const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js'));
  console.log(`🔎 [handler.js] Encontrados ${files.length} archivos en /plugins:`, files);

  for (const file of files) {
    console.log(`🔎 [handler.js] Cargando "${file}"...`);
    try {
      const module = await import(`./plugins/${file}`);
      console.log(`✅ [handler.js] "${file}" cargado correctamente.`);
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

  console.log('🔎 [handler.js] Todos los plugins procesados.');
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
console.log('🔎 [handler.js] loadPlugins() terminó. handler.js listo para exportarse.');

export async function handler(sock, m) {
  const msg = m.messages[0];
  if (!msg?.message) return;

  const from = msg.key.remoteJid;
  const type = Object.keys(msg.message)[0];

  // --- Manejo de mensajes de audio ---
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
    '';

  if (!body) return;

  if (!body.startsWith(botConfig.prefix)) {
    const iaEstaActiva = await chatActivo(from);
    if (iaEstaActiva) {
      const respuestaIA = await preguntarIA(from, body);
      if (respuestaIA) {
        await sock.sendMessage(from, { text: respuestaIA }, { quoted: msg });
      }
    }
    return;
  }

  const args = body.slice(botConfig.prefix.length).trim().split(/ +/);
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

🚫 *Créditos agotados*

Hola, tu saldo de créditos ya no es
suficiente para realizar más consultas.

╭──────── 💎 RECARGA ────────╮
│ 💳 Recarga tus créditos:
│ 📲 +51 924 894 999
╰────────────────────────────╯

🛒 Para ver los paquetes disponibles
y precios utiliza:

➜ *.comprar*

━━━━━━━━━━━━━━━━━━

⚡ Recarga y continúa usando
🤖 *SOSI CODEX* sin límites.`
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
      const usuarioActualizado = await User.findOneAndUpdate(
        { numero: sender },
        { $inc: { creditos: -costo } },
        { returnDocument: 'after' }
      );
      await sock.sendMessage(from, { text: `💳 Se descontaron *${costo}* crédito(s). Créditos restantes: *${usuarioActualizado.creditos}*` });
    }
  } catch (err) {
    console.error(`Error ejecutando "${cmdName}":`, err);
    await sock.sendMessage(from, { text: '❌ Ocurrió un error al ejecutar el comando.' }, { quoted: msg });
  }
}