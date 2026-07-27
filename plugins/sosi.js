// plugins/sosi.js
export default {
  command: ['sosi'],
  cost: 0,
  exec: async ({ sock, msg, from }) => {
    const texto = `╭══════════════════════╮
│     🤖 MENÚ SOSI     │
╰══════════════════════╯

Estos son los comandos disponibles en esta sección:

😀 *.emoji* — genera/mezcla emoji
🖼️ *.iqc* — imagen a QC (sticker circular, según lo tengas configurado)
📸 *.igpc* — imagen a PC/perfil (según tu función)
📦 *.gitzip* — descarga un repositorio de GitHub como ZIP
🖼️ *.fotoqr* — genera código QR con imagen
👤 *.perfil* — consulta perfil de WhatsApp por número
📍 *.ubicacion* — consulta ubicación aproximada por IP

━━━━━━━━━━━━━━━━━━
Usa cada comando escribiendo el prefijo seguido del texto o argumento que pida.
🤖 *SOSI CODEX*`;

    await sock.sendMessage(from, { text: texto }, { quoted: msg });
  }
};