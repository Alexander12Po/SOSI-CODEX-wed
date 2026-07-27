import axios from 'axios'

export default {
  command: ['telp'],
  description: 'Consulta líneas telefónicas asociadas a un DNI',
  exec: async ({ sock, from, msg, args }) => {
    const dni = args[0]
    
    // Validación de DNI (exactamente 8 dígitos)
    if (!dni || !/^\d{8}$/.test(dni)) {
      await sock.sendMessage(
        from,
        { text: '❌ Debes ingresar un DNI válido de 8 dígitos.\n\nEjemplo: *.telp 12345678*' },
        { quoted: msg }
      )
      return false // Evita cobros por formato incorrecto
    }

    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando líneas telefónicas...' }, { quoted: msg })

      // Petición a la API con los Headers correctos
      const { data: response } = await axios.get(
        `https://api-codart.cgrt.org/api/v1/consultas/fd/telp/${dni}`,
        {
          timeout: 15000,
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      )

      // Verificar si la consulta fue exitosa y hay datos
      if (!response.success || !response.data || response.data.lineas_encontradas === 0) {
        await sock.sendMessage(
          from,
          { text: '❌ No se encontraron líneas telefónicas asociadas a este DNI.' },
          { quoted: msg }
        )
        return false // Evita cobros si no hay resultados
      }

      // Construcción del mensaje con TODOS los datos del JSON
      let resultado = `┌─❐ *LÍNEAS TELEFÓNICAS ENCONTRADAS* ❐\n`
      resultado += `│\n`
      resultado += `📱 *Total:* ${response.data.lineas_encontradas} línea(s)\n`
      resultado += `│\n`
      
      response.data.lineas.forEach((item, index) => {
        resultado += `├─ *${index + 1}.* 📞 ${item.telefono}\n`
        resultado += `│  🏢 Operador: ${item.operador}\n`
        resultado += `│  🏢 Empresa: ${item.empresa}\n`
        resultado += `│  📅 Periodo: ${item.periodo}\n`
        resultado += `│\n`
      })
      
      resultado += `└────────────`

      await sock.sendMessage(from, { text: resultado }, { quoted: msg })

    } catch (err) {
      console.error('Error consultando teléfono:', err?.response?.data || err.message)
      const mensaje = err.code === 'ECONNABORTED'
        ? '⏱️ La consulta tardó demasiado y se canceló. Intenta de nuevo en unos segundos.'
        : '❌ Ocurrió un error al consultar. Verifica el DNI o si el servicio está disponible.'
      await sock.sendMessage(
        from,
        { text: mensaje },
        { quoted: msg }
      )
      return false // Evita cobros si la API falla
    }
  }
}
