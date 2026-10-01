import User from '../models/User.js'

export default {
  command: ['eliminarusuarios', 'clearusers', 'purge', 'borrarusuarios'],
  cost: 0,
  exec: async ({ sock, msg, from, sender }) => {
    // ✅ Verificar que sea el administrador (tu número)
    const adminNumeros = ['51924894999'] // ⚠️ CAMBIA ESTO por tu número real
    
    const senderNumero = sender.split('@')[0]
    if (!adminNumeros.includes(senderNumero)) {
      await sock.sendMessage(from, { 
        text: '❌ *Acceso denegado*\n\nSolo el administrador puede ejecutar este comando.' 
      }, { quoted: msg })
      return false
    }

    try {
      const totalUsuarios = await User.countDocuments()
      
      if (totalUsuarios === 0) {
        await sock.sendMessage(from, { 
          text: '⚠️ *No hay usuarios registrados*\n\nLa base de datos ya está vacía.' 
        }, { quoted: msg })
        return false
      }

      const resultado = await User.deleteMany({})
      
      await sock.sendMessage(from, { 
        text: `╭══════════════════════╮
│ 🗑️ *SOSI CODEX* | LIMPIEZA │
╰══════════════════════╯

✅ Se eliminaron *${resultado.deletedCount}* usuarios de la base de datos.

━━━━━━━━━━━━━━━━━━
💡 La base de datos ahora está vacía.
Los usuarios deberán registrarse nuevamente.` 
      }, { quoted: msg })
      
      console.log(`[ELIMINAR USUARIOS] Se eliminaron ${resultado.deletedCount} usuarios`)
      return true
    } catch (err) {
      console.error('Error eliminando usuarios:', err)
      await sock.sendMessage(from, { 
        text: '❌ *Error al eliminar usuarios*\n\nNo se pudo completar la operación.' 
      }, { quoted: msg })
      return false
    }
  }
}
