# Desplegar SOSI CODEX en Render (con sesión persistente)

## 1. Archivos nuevos/modificados

- **`mongoAuthState.js`** (nuevo): guarda la sesión de WhatsApp en MongoDB.
- **`zen.js`** (reemplaza al actual): usa `useMongoAuthState()` en vez de
  `useMultiFileAuthState('./session')`, y lee el número para pairing desde
  una variable de entorno si existe.

Copia ambos archivos a la raíz de tu repo, reemplazando el `zen.js` actual.

## 2. Instalar la dependencia que falta

Tu proyecto necesita el driver oficial de MongoDB:

```bash
npm install mongodb --save
```

Esto va a modificar tu `package.json` y `package-lock.json` — súbelos también.

## 3. Corregir el `.gitignore`

Vi que tienes un archivo llamado `gitignore.txt`. Git solo reconoce el
nombre exacto **`.gitignore`** (sin extensión). Renómbralo así, y asegúrate
de que contenga al menos:

```
node_modules/
.env
session/
```

(La carpeta `session/` ya no se va a usar para production, pero no está de
más ignorarla por si la usas en local.)

## 4. Variables de entorno en Render

En tu servicio de Render → pestaña **Environment** → **Add Environment
Variable**, agrega:

| Key | Value |
|---|---|
| `MONGODB_URI` | `mongodb+srv://SOSICODEX:****@sosipopeye.bize1jo.mongodb.net/SOSI-CODEX?appName=SOSIPOPEYE` |
| `GROQ_API_KEY` | tu key de Groq |
| `PAIRING_NUMBER` | tu número con código de país, ej `521234567890` (solo si usas `loginMethod: 'pairing'` en `config.js`) |

**Nunca pongas estos valores directamente en el código ni en un `.env`
subido al repo.**

## 5. Tipo de servicio en Render

⚠️ Corrección respecto a la versión anterior de esta guía: los
**Background Workers ya no están disponibles en el plan gratuito** de
Render (requieren plan Starter de pago, $7/mes). En el plan free tu bot
debe desplegarse como **Web Service**.

- New → **Web Service**
- Conecta tu repo `SOSI-CODEX-wed`
- Build Command: `npm install`
- Start Command: `node zen.js` (ajusta si tu `package.json` usa otro `main`)

## 6. Evitar que Render "duerma" el bot (plan free)

Los Web Services gratuitos de Render se apagan tras **15 minutos sin
tráfico HTTP entrante**. Un bot de WhatsApp no recibe ese tipo de tráfico
por sí solo, así que sin hacer nada, tu bot se desconectaría cada rato.

**Solución (incluida ya en el `zen.js` que te compartí):** el archivo
ahora levanta un mini servidor HTTP que responde "OK" a cualquier
petición, usando el puerto que Render asigna en `process.env.PORT`. Esto
por sí solo no evita el apagado — falta la segunda parte:

1. Después del deploy, copia la URL pública que te da Render (algo como
   `https://sosi-codex-wed.onrender.com`).
2. Crea una cuenta gratuita en **[cron-job.org](https://cron-job.org)**
   (o UptimeRobot).
3. Configura un "cron job" / "monitor" que le pegue a esa URL **cada 10
   minutos**, las 24 horas.

Con eso, Render nunca detecta 15 minutos de inactividad y el bot se
mantiene despierto. **Aclaración importante:** esto es un workaround no
oficial — Render no lo garantiza como método soportado, y en teoría
podría dejar de funcionar si cambian esa política. Si el bot es para uso
serio (no solo pruebas), la alternativa confiable es pasar al plan
**Starter ($7/mes)**, donde el servicio no se apaga por inactividad.

## 6. Primera vinculación

La primera vez vas a necesitar vincular el número de todas formas:

- **Con QR**: entra a los **Logs** de Render justo después del primer
  deploy; el QR se imprime ahí en ASCII. Tienes pocos segundos para
  escanearlo antes de que expire, así que ten Render abierto y WhatsApp
  listo antes de que termine el deploy.
- **Con pairing code**: define `PAIRING_NUMBER` antes del primer deploy;
  el código aparecerá en los logs para que lo ingreses en WhatsApp.

Una vez vinculado, las credenciales quedan guardadas en tu colección
`baileys_auth` de MongoDB. **A partir de ahí, cualquier redeploy o
reinicio de Render reutilizará esa sesión automáticamente**, sin volver a
pedir QR ni código.

## 7. Si necesitas resetear la sesión

Si algún día necesitas desvincular y volver a empezar de cero, borra la
colección `baileys_auth` desde MongoDB Atlas, o llama a
`clearMongoAuthState()` (exportada en `mongoAuthState.js`) desde un script
puntual.
