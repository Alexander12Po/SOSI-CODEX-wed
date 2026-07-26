# ZEN-BOT (base)

Bot de WhatsApp minimalista usando Baileys, pensado para correr en Termux.

## Instalación en Termux

```bash
pkg update -y && pkg upgrade -y
pkg install -y nodejs git

# entra a la carpeta del bot (donde descomprimiste/subiste estos archivos)
cd zenbot

npm install
```

## Antes de iniciar

Abre `config.js` y cambia `ownerNumber` por tu número (con código de país, sin `+`).

Abre el archivo `.env` y pon tu token de la API de RENIEC (apis.net.pe u otra compatible):

```
DNI_API_TOKEN=tu_token_real_aqui
```

**No compartas este archivo ni lo subas a un repositorio público.**

## Iniciar el bot

```bash
node zen.js
```

Te va a pedir tu número de WhatsApp (con código de país, ej: `521234567890`).
Después te mostrará un **código de 8 dígitos**.

En tu celular:
1. Abre WhatsApp
2. Ve a **Ajustes > Dispositivos vinculados**
3. Toca **Vincular con número de teléfono**
4. Ingresa el código que te dio la terminal

Cuando veas `✅ ZEN-BOT conectado correctamente`, ya está listo.

## Comandos incluidos

| Comando | Descripción |
|---|---|
| `.menu` | Muestra el menú de comandos |
| `.ping` | Mide la velocidad del bot |
| `.info` | Info del bot y del sistema |
| `.dni <número>` | Consulta datos de una persona por su DNI (Perú) |

## Agregar tus propios comandos

Crea un archivo nuevo dentro de `plugins/`, por ejemplo `plugins/saludo.js`:

```js
export default {
  command: ['hola'],
  description: 'Saluda',
  exec: async ({ sock, from, msg }) => {
    await sock.sendMessage(from, { text: '¡Hola! 👋' }, { quoted: msg })
  }
}
```

Reinicia el bot (`node zen.js`) y el comando `.hola` estará disponible automáticamente.

## Notas

- La carpeta `session/` guarda tu sesión de WhatsApp. **No la compartas ni la subas a GitHub.**
- Si el bot deja de conectar y no reconoce el código, borra la carpeta `session/` y vuelve a vincular.
- Para mantenerlo corriendo en segundo plano en Termux, puedes usar `tmux` o `nohup node zen.js &`.
