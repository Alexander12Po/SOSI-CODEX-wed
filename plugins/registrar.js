import User from '../models/User.js'

export default {
  command: ['registrar', 'register'],
  cost: 0,
  exec: async ({ sock, msg, from, sender, args }) => {
    const texto = args.join(' ').trim()
    
    if (!texto.includes('|')) {
      await sock.sendMessage(from, { 
        text: '⚠️ *Formato incorrecto*\n\nUsa el comando así:\n *.registrar <nombre>|<contraseña>*\n\n📝 Ejemplo: *.registrar Alex|123456*' 
      }, { quoted: msg })
      return false
    }

    const [nombre, password] = texto.split('|').map(s => s.trim())

    if (!nombre || !password) {
      await sock.sendMessage(from, { 
        text: '️ *Datos incompletos*\n\nDebes proporcionar nombre y contraseña.\n\n📝 Ejemplo: *.registrar Alex|123456*' 
      }, { quoted: msg })
      return false
    }

    if (nombre.length < 3 || nombre.length > 20) {
      await sock.sendMessage(from, { 
        text: '⚠️ *Nombre inválido*\n\nEl nombre debe tener entre *3 y 20 caracteres*.' 
      }, { quoted: msg })
      return false
    }

    if (password.length < 4) {
      await sock.sendMessage(from, { 
        text: '⚠️ *Contraseña muy corta*\n\nLa contraseña debe tener al menos *4 caracteres*.' 
      }, { quoted: msg })
      return false
    }

    try {
      // ✅ Verificar si el número ya está registrado
      const usuarioExistente = await User.findOne({ numero: sender })
      if (usuarioExistente) {
        await sock.sendMessage(from, { 
          text: '⚠️ *Ya estás registrado*\n\nEste número de WhatsApp ya tiene una cuenta.\n\n💡 Si olvidaste tu contraseña, contacta al administrador.' 
        }, { quoted: msg })
        return false
      }

      // ✅ VERIFICAR SI EL NOMBRE YA ESTÁ EN USO
      const nombreEnUso = await User.findOne({ nombre: { $regex: new RegExp(`^${nombre}$`, 'i') } })
      if (nombreEnUso) {
        await sock.sendMessage(from, { 
          text: `❌ *Nombre no disponible*\n\nEl nombre "*${nombre}*" ya está siendo usado por otro usuario.\n\n💡 Por favor, elige un nombre diferente.\n\n📝 Ejemplo: *.registrar ${nombre}2|${password}*` 
        }, { quoted: msg })
        return false
      }

      // ✅ Crear el nuevo usuario
      const nuevoUsuario = new User({
        nombre: nombre,
        numero: sender,
        password: password,
        creditos: 10, // Créditos iniciales de regalo
        fecha: new Date().toLocaleDateString('es-PE')
      })

      await nuevoUsuario.save()

      await sock.sendMessage(from, { 
        text: `╭══════════════════════╮
│ ✅ *SOSI CODEX* | REGISTRO │
╰══════════════════════╯

 ¡Bienvenido *${nombre}*!

Tu cuenta ha sido creada exitosamente.

━━━━━━━━━━━━━━━━━━
📊 *Detalles de tu cuenta:*
👤 Nombre: *${nombre}*
💳 Créditos iniciales: *10*
📅 Fecha de registro: *${new Date().toLocaleDateString('es-PE')}*

━━━━━━━━━━━━━━━━━━
💡 Ya puedes usar todos los comandos disponibles.
Escribe *.menu* para ver la lista completa.` 
      }, { quoted: msg })

      console.log(`[REGISTRO] Nuevo usuario: ${nombre} (${sender})`)
      return true
    } catch (err) {
      console.error('Error en registro:', err)
      await sock.sendMessage(from, { 
        text: '❌ *Error al registrar*\n\nOcurrió un problema al crear tu cuenta. Intenta de nuevo.' 
      }, { quoted: msg })
      return false
    }
  }
}
