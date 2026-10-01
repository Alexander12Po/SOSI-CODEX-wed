import { consultarTelegram, enviarResultadoWhatsApp } from '../telegram.js'

// ✅ Configuración centralizada de todos los comandos de familia (todos usan DNI)
const COMANDOS_FAMILIA = {
  ag: {
    comandoTelegram: '/ag',
    descripcion: 'búsqueda general',
    ejemplo: '.ag <DNI>'
  },
  fam: {
    comandoTelegram: '/fam',
    descripcion: 'consulta familiar básica',
    ejemplo: '.fam <DNI>'
  },
  fam2: {
    comandoTelegram: '/fam2',
    descripcion: 'consulta familiar avanzada',
    ejemplo: '.fam2 <DNI>'
  },
  fam3: {
    comandoTelegram: '/fam3',
    descripcion: 'consulta familiar extendida',
    ejemplo: '.fam3 <DNI>'
  },
  fam4: {
    comandoTelegram: '/fam4',
    descripcion: 'consulta familiar completa',
    ejemplo: '.fam4 <DNI>'
  }
}

export default {
  // ✅ Todos los comandos que este plugin manejará
  command: ['ag', 'fam', 'fam2', 'fam3', 'fam4'],
  cost: 0,
  
  exec: async ({ sock, msg, from, args, body }) => {
    // 1. Detectar qué comando se usó
    const prefijo = body.startsWith('/') ? '/' : '.'
    const cmdUsado = body.slice(prefijo.length).trim().split(/ +/)[0].toLowerCase()
    
    // 2. Obtener la configuración del comando
    const config = COMANDOS_FAMILIA[cmdUsado]
    if (!config) {
      await sock.sendMessage(from, { 
        text: '⚠️ Comando no reconocido.' 
      }, { quoted: msg })
      return false
    }
    
    // 3. Validar que haya un DNI
    const valor = args.join(' ').trim()
    if (!valor) {
      await sock.sendMessage(from, { 
        text: `⚠️ *Formato incorrecto*\n\nUsa el comando así:\n👉 *${prefijo}${cmdUsado} <DNI>*\n\n Ejemplo: ${config.ejemplo}` 
      }, { quoted: msg })
      return false
    }
    
    // 4. Validar que sea un número (DNI)
    if (!/^\d{8}$/.test(valor)) {
      await sock.sendMessage(from, { 
        text: `⚠️ *DNI inválido*\n\nEl DNI debe tener *8 dígitos numéricos*.\n\n📝 Ejemplo: ${config.ejemplo}` 
      }, { quoted: msg })
      return false
    }
    
    // 5. Construir el comando para Telegram
    const comandoTelegram = `${config.comandoTelegram} ${valor}`
    
    // 6. Enviar mensaje de carga
    const msgCarga = await sock.sendMessage(from, { 
      text: `🛡️ *SOSI CODEX* | Realizando ${config.descripcion} del DNI *${valor}*...\n⏳ Por favor, espere un momento.` 
    }, { quoted: msg })
    
    // 7. Consultar Telegram
    let salida
    try {
      salida = await consultarTelegram(comandoTelegram)
    } catch (err) {
      console.error(`Error consultando (${cmdUsado}):`, err)
      if (msgCarga?.key) {
        await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
      }
      await sock.sendMessage(from, { 
        text: '❌ *Error de conexión*\n\nNo se pudo comunicar con el servicio. Intenta de nuevo en un momento.' 
      }, { quoted: msg })
      return false
    }
    
    // 8. Manejar sin resultados
    if (!salida.length) {
      if (msgCarga?.key) {
        await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
      }
      await sock.sendMessage(from, { 
        text: `⚠️ *Sin resultados*\n\nNo se encontró información para el DNI *${valor}*. Verifica el número o intenta más tarde.` 
      }, { quoted: msg })
      return false
    }
    
    // 9. Eliminar mensaje de carga y enviar resultado
    if (msgCarga?.key) {
      await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
    }
    
    await enviarResultadoWhatsApp(sock, from, salida)
  }
}
