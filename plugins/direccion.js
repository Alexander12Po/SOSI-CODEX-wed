import axios from 'axios'

export default {
  command: ['dir', 'direccion', 'direcciones'],
  description: 'Consulta el historial de direcciones de una persona por su DNI',
  exec: async ({ sock, from, msg, args }) => {
    const s_dni = args[0]

    // Validación de DNI (8 dígitos)
    if (!s_dni || !/^\d{8}$/.test(s_dni)) {
      await sock.sendMessage(
        from,
        { text: '❌ *Uso incorrecto.*\nDebes ingresar un DNI válido de 8 dígitos.\n\n*Ejemplo:* .dir 12345678' },
        { quoted: msg }
      )
      return false
    }

    // Tu token directo
    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando historial de direcciones...' }, { quoted: msg })

      // Petición a la API de Direcciones
      const { data: response } = await axios.get(`https://api-codart.cgrt.org/api/v1/consultas/fd/dir/${s_dni}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      // Verificar si la consulta fue exitosa
      if (!response.success || !response.data || !response.data.direcciones) {
        await sock.sendMessage(
          from,
          { text: '❌ No se encontró historial de direcciones para el DNI ingresado.' },
          { quoted: msg }
        )
        return false
      }

      const info = response.data
      const totalRegistros = info.total_registros

      if (totalRegistros === 0 || info.direcciones.length === 0) {
        await sock.sendMessage(
          from,
          { text: `ℹ️ No se registraron direcciones para el DNI: ${info.consulta}` },
          { quoted: msg }
        )
        return false
      }

      // Construcción del encabezado del mensaje
      let text = `┌─❐ *HISTORIAL DE DIRECCIONES* ❐\n`
      text += `│\n`
      text += `│ 🆔 *DNI Consultado:* ${info.consulta}\n`
      text += `│ 📍 *Total Registros:* ${totalRegistros}\n`
      text += `│\n`
      text += `└────────────\n\n`

      // Recorrer e integrar cada dirección en la respuesta
      info.direcciones.forEach((dir, index) => {
        text += `🏠 *Registro ${index + 1}*\n`
        text += `• *Departamento/Prov/Dist:* ${dir.ubicacion}\n`
        text += `• *Dirección:* ${dir.direccion}\n`
        text += `• *Fuente:* ${dir.fuente}\n`
        text += `─────────────────\n`
      })

      // Enviar el mensaje estructurado a WhatsApp
      await sock.sendMessage(from, { text: text.trim() }, { quoted: msg })

    } catch (err) {
      console.error('Error consultando Direcciones:', err?.response?.data || err.message)
      
      const errorDeApi = err?.response?.data?.message || 'Ocurrió un error inesperado al consultar las direcciones.'
      
      await sock.sendMessage(
        from,
        { text: `❌ *Error en la consulta:*\n${errorDeApi}` },
        { quoted: msg }
      )
      return false
    }
  }
}
