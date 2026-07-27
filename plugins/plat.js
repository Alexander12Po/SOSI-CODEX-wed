import axios from 'axios'

export default {
  command: ['plat', 'ficha'],
  description: 'Consulta la ficha técnica completa de un vehículo por su placa (características, propietarios, series)',
  exec: async ({ sock, from, msg, args }) => {
    let placa = args[0]

    // Validación de placa
    if (!placa) {
      await sock.sendMessage(
        from,
        { text: '❌ *Uso incorrecto.*\nDebes ingresar el número de placa.\n\n*Ejemplo:* .plat D5G960' },
        { quoted: msg }
      )
      return false
    }

    // Limpieza de placa
    placa = placa.toUpperCase().replace(/[^A-Z0-9]/g, '')

    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando ficha técnica del vehículo...' }, { quoted: msg })

      const { data: response } = await axios.get(`https://api-codart.cgrt.org/api/v1/consultas/fd/plat/${placa}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      // Verificar si la consulta fue exitosa
      if (!response.success || !response.data) {
        await sock.sendMessage(
          from,
          { text: '❌ No se encontró información para la placa ingresada.' },
          { quoted: msg }
        )
        return false
      }

      const info = response.data
      const caracteristicas = info.caracteristicas || {}
      const extra = info.extra || {}
      const propietarios = info.propietarios || []

      // Construcción del mensaje
      let text = `┌─❐ *FICHA TÉCNICA DEL VEHÍCULO* ❐\n`
      text += `│\n`
      text += `│ 🚗 *Placa:* ${info.placa}\n`
      text += `│ 🔢 *N° Serie:* ${info.numero_serie || 'N/A'}\n`
      text += `│ 🔢 *VIN:* ${info.numero_vin || 'N/A'}\n`
      text += `│ 🔧 *N° Motor:* ${info.numero_motor || 'N/A'}\n`
      text += `│\n`
      text += `└────────────\n\n`

      text += `┌─ 🏷️ *CARACTERÍSTICAS*\n`
      text += `│ • *Marca:* ${caracteristicas.marca || 'N/A'}\n`
      text += `│ • *Modelo:* ${caracteristicas.modelo || 'N/A'}\n`
      text += `│ • *Estado:* ${caracteristicas.estado || 'N/A'}\n`
      text += `│ • *Combustible:* ${caracteristicas.tipo_combustible || 'N/A'}\n`
      text += `└────────────\n\n`

      text += `┌─ 📦 *DETALLES ADICIONALES*\n`
      text += `│ • *Asientos:* ${extra.asientos || 'N/A'}\n`
      text += `│ • *Pasajeros:* ${extra.pasajeros || 'N/A'}\n`
      text += `│ • *Peso Bruto:* ${extra.peso_bruto || 'N/A'} Ton\n`
      text += `│ • *Peso Neto:* ${extra.peso_neto || 'N/A'} Ton\n`
      text += `└────────────\n\n`

      if (propietarios.length > 0) {
        text += `┌─ 👤 *PROPIETARIO(S)*\n`
        propietarios.forEach((p, index) => {
          text += `│ *Propietario ${index + 1}*\n`
          text += `│ • *Nombre:* ${p.nombres || 'N/A'}\n`
          text += `│ • *DNI:* ${p.dni || 'N/A'}\n`
          text += `│ • *Partida:* ${p.partida || 'N/A'}\n`
          text += `│ • *L.E.:* ${p.le || 'N/A'}\n`
          text += `│ • *Fecha:* ${p.fecha_propietario || 'N/A'}\n`
          text += `│ • *Dirección:* ${p.direccion || 'N/A'}\n`
          text += `│\n`
        })
        text += `└────────────`
      } else {
        text += `⚠️ _No se encontraron propietarios registrados._`
      }

      await sock.sendMessage(from, { text: text.trim() }, { quoted: msg })

    } catch (err) {
      console.error('Error consultando Ficha Técnica:', err?.response?.data || err.message)

      const errorDeApi = err?.response?.data?.message || 'Ocurrió un error inesperado al consultar la ficha técnica.'

      await sock.sendMessage(
        from,
        { text: `❌ *Error en la consulta:*\n${errorDeApi}` },
        { quoted: msg }
      )
      return false
    }
  }
}
