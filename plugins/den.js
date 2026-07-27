import axios from 'axios'

export default {
  command: ['den', 'denact'],
  description: 'Consulta el resumen de denuncias policiales (con condición e intervención) por DNI',
  exec: async ({ sock, from, msg, args }) => {
    const s_dni = args[0]

    // Validación de DNI (8 dígitos)
    if (!s_dni || !/^\d{8}$/.test(s_dni)) {
      await sock.sendMessage(
        from,
        { text: '❌ *Uso incorrecto.*\nDebes ingresar un DNI válido de 8 dígitos.\n\n*Ejemplo:* .den 00000000' },
        { quoted: msg }
      )
      return false
    }

    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando resumen de denuncias...' }, { quoted: msg })

      const { data: response } = await axios.get(`https://api-codart.cgrt.org/api/v1/consultas/fd/den/${s_dni}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      // Verificar si la consulta fue exitosa
      if (!response.success || !response.data || !response.data.denuncias) {
        await sock.sendMessage(
          from,
          { text: '❌ No se encontró información de denuncias para el DNI ingresado.' },
          { quoted: msg }
        )
        return false
      }

      const info = response.data
      const totalDenuncias = info.cantidad_denuncias

      if (totalDenuncias === 0 || info.denuncias.length === 0) {
        await sock.sendMessage(
          from,
          { text: `ℹ️ No se registraron denuncias para el DNI: ${info.consulta}` },
          { quoted: msg }
        )
        return false
      }

      // Encabezado
      let text = `┌─❐ *RESUMEN DE DENUNCIAS* ❐\n`
      text += `│\n`
      text += `│ 🆔 *DNI Consultado:* ${info.consulta}\n`
      text += `│ 🚨 *Total de Denuncias:* ${totalDenuncias}\n`
      text += `│\n`
      text += `└────────────\n\n`

      // Detalle de cada denuncia
      info.denuncias.forEach((d) => {
        text += `📋 *Denuncia N°${d.numero}* (${d.tipo})\n`
        text += `• *Comisaría:* ${d.comisaria}\n`
        text += `• *N° Orden:* ${d.n_orden}\n`
        text += `• *Fecha del hecho:* ${d.f_hecho}\n`
        text += `• *Fecha de registro:* ${d.f_registro}\n`
        text += `• *Condición:* ${d.condicion}\n`
        text += `• *Intervención:* ${d.intervencion}\n`
        text += `• *Resumen:* ${d.resumen}\n`
        text += `─────────────────\n`
      })

      await sock.sendMessage(from, { text: text.trim() }, { quoted: msg })

    } catch (err) {
      console.error('Error consultando Denuncias (resumen):', err?.response?.data || err.message)

      const errorDeApi = err?.response?.data?.message || 'Ocurrió un error inesperado al consultar las denuncias.'

      await sock.sendMessage(
        from,
        { text: `❌ *Error en la consulta:*\n${errorDeApi}` },
        { quoted: msg }
      )
      return false
    }
  }
}
