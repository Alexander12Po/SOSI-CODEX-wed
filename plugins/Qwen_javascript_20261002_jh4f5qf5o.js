import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const qrPath = path.join(__dirname, '../media/qr-yape.jpg')

// ✅ Palabras clave que detectan un pedido
const PALABRAS_CLAVE = [
  'pedido', 'pedir', 'quiero', 'domicilio', 'delivery',
  'hamburguesa', 'amburgesa', 'burger', 'triple', 'doble',
  'comprar', 'ordenar', 'reservar', 'menu', 'menú',
  'cuanto cuesta', 'precio', 'costo', 'valor',
  'quiero hacer', 'me gustaria', 'me gustaría'
]

export default {
  command: ['pedido'], // También funciona como comando manual: .pedido
  cost: 0,
  noPrefix: true, // ✅ Esto permite que funcione sin prefijo
  
  exec: async ({ sock, msg, from, body, sender }) => {
    const texto = body.toLowerCase()
    
    // ✅ Verificar si el mensaje contiene palabras clave de pedido
    const esPedido = PALABRAS_CLAVE.some(palabra => texto.includes(palabra))
    
    if (!esPedido) return false
    
    // ✅ Verificar que la imagen del QR exista
    if (!fs.existsSync(qrPath)) {
      console.error('❌ No se encontró el QR de Yape en:', qrPath)
      await sock.sendMessage(from, { 
        text: '⚠️ *Error*\n\nEl QR de pago no está disponible en este momento. Contacta al administrador.' 
      }, { quoted: msg })
      return false
    }
    
    // ✅ Enviar el QR con instrucciones de pago
    await sock.sendMessage(from, { 
      image: fs.readFileSync(qrPath),
      caption: `══════════════════════╮
│ 💳 *SOSI CODEX* | PAGO YAPE │
╰══════════════════════╯

🍔 *¡Perfecto! Tu pedido ha sido detectado*

Para completar tu pedido, sigue estos pasos:

━━━━━━━━━━━━━━━━━━
📱 *PASO 1:* Escanea el QR de arriba con tu app de *Yape*

💰 *PASO 2:* Ingresa el monto de tu pedido

📝 *PASO 3:* En la descripción escribe:
   • Tu nombre
   • Dirección de entrega
   • Detalle del pedido

✅ *PASO 4:* Envía la captura del pago por este chat

━━━━━━━━━━━━━━━━━━
⏱️ *Tiempo de entrega:* 30-45 minutos
📍 *Zona de cobertura:* Consulta con el administrador

💡 *¿Tienes dudas?* Escríbenos al +51 924 894 999

━━━━━━━━━━━━━━━━━━
️ *SOSI CODEX* - Tu bot de confianza`
    }, { quoted: msg })
    
    console.log(`[PEDIDO] Pedido detectado de: ${sender}`)
    return true
  }
}