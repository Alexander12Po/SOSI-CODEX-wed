import axios from 'axios'

export default {
  command: ['soat', 'hsoat'],
  description: 'Consulta el estado y vigencia del SOAT de un vehículo por su placa',
  exec: async ({ sock, from, msg, args }) => {
    let placa = args[0]

    // Validación de placa
    if (!placa) {
      await sock.sendMessage(
        from,
        { text: '❌ *Uso incorrecto.*\nDebes ingresar la placa del vehículo.\n\n*Ejemplo:* .soat D5G960' },
        { quoted: msg }
      )
      return false
    }

    // Limpieza de placa (formato alfanumérico)
    placa = placa.toUpperCase().replace(/[^A-Z0-9]/g, '')

    // Token
    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando estado del SOAT...' }, { quoted: msg })

      // Petición a la API de SOAT
      const { data: response } = await axios.get(`https://api-codart.cgrt.org/api/v1/consultas/fd/hsoat/${placa}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      // Validación de datos
      if (!response.success || !response.data || !response.data.historial) {
        await sock.sendMessage(
          from,
          { text: '❌ No se encontró información de SOAT para esta placa.' },
          { quoted: msg }
        )
        return false
      }

      const info = response.data
      let text = `┌─❐ *ESTADO DEL SOAT* ❐\n`
      text += `│\n`
      text += `│ 🚗 *Placa:* ${info.placa}\n`
      text += `│ 📋 *Registros:* ${info.cantidad_registros}\n`
      text += `│\n`
      text += `└────────────\n\n`

      // Recorrer historial
      info.historial.forEach((h, index) => {
        text += `🛡️ *Seguro ${index + 1} (${h.estado})*\n`
        text += `• *Compañía:* ${h.compania}\n`
        text += `• *Póliza:* ${h.poliza}\n`
        text += `• *Clase:* ${h.clase}\n`
        text += `• *Uso:* ${h.uso}\n`
        text += `• *Tipo:* ${h.tipo_certificado}\n`
        text += `• *Vigencia:* ${h.fecha_inicio} a ${h.fecha_fin}\n`
        text += `─────────────────\n`
      })

      await sock.sendMessage(from, { text: text.trim() }, { quoted: msg })

    } catch (err) {
      console.error('Error en SOAT:', err?.response?.data || err.message)
      const errorDeApi = err?.response?.data?.message || 'Error al consultar el SOAT.'
      await sock.sendMessage(from, { text: `❌ *Error:* ${errorDeApi}` }, { quoted: msg })
      return false
    }
  }
}
