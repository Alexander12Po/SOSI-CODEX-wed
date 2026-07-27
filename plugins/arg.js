import axios from 'axios'

export default {
  command: ['ag', 'familia', 'arbol'],
  description: 'Consulta el árbol genealógico y relaciones familiares por DNI',
  exec: async ({ sock, from, msg, args }) => {
    const s_dni = args[0]

    // Validación de DNI (8 dígitos)
    if (!s_dni || !/^\d{8}$/.test(s_dni)) {
      await sock.sendMessage(
        from,
        { text: '❌ Debes ingresar un DNI válido de 8 dígitos.\n\nEjemplo: *.ag 12345678*' },
        { quoted: msg }
      )
      return false
    }

    // Tu token directo
    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Buscando relaciones familiares y árbol genealógico...' }, { quoted: msg })

      // Petición a la nueva API de Árbol Genealógico
      const { data: response } = await axios.get(`https://api-codart.cgrt.org/api/v1/consultas/fd/ag/${s_dni}`, {
        timeout: 15000,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      // Verificar si la consulta fue exitosa
      if (!response.success || !response.data || !response.data.relaciones) {
        await sock.sendMessage(
          from,
          { text: '❌ No se encontraron datos familiares para el DNI ingresado.' },
          { quoted: msg }
        )
        return false
      }

      const info = response.data
      const totalFamiliares = info.familiares

      if (totalFamiliares === 0 || info.relaciones.length === 0) {
        await sock.sendMessage(
          from,
          { text: `ℹ️ No se registraron familiares para el DNI: ${info.consulta}` },
          { quoted: msg }
        )
        return false
      }

      // Construcción del encabezado del mensaje
      let text = `┌─❐ *ÁRBOL GENEALÓGICO* ❐\n`
      text += `│\n`
      text += `│ 🆔 *DNI Consultado:* ${info.consulta}\n`
      text += `│ 👥 *Familiares Detectados:* ${totalFamiliares}\n`
      text += `│\n`
      text += `└────────────\n\n`

      // Recorrer e integrar cada familiar en la respuesta
      info.relaciones.forEach((familiar, index) => {
        text += `👤 *Familiar ${index + 1}* — *${familiar.relacion}*\n`
        text += `• *DNI:* ${familiar.dni}\n`
        text += `• *Nombre:* ${familiar.nombres} ${familiar.apellidos}\n`
        text += `• *Edad:* ${familiar.edad} años (${familiar.sexo})\n`
        text += `• *Verificación:* ${familiar.verificacion === 'ALTO' ? '🟢 ALTO' : '🟡 MEDIO'}\n`
        text += `─────────────────\n`
      })

      // Enviar el mensaje estructurado a WhatsApp
      await sock.sendMessage(from, { text: text.trim() }, { quoted: msg })

    } catch (err) {
      console.error('Error consultando Árbol Genealógico:', err?.response?.data || err.message)

      const errorDeApi = err.code === 'ECONNABORTED'
        ? '⏱️ La consulta tardó demasiado y se canceló. Intenta de nuevo en unos segundos.'
        : (err?.response?.data?.message || 'Ocurrió un error al consultar el árbol genealógico.')

      await sock.sendMessage(
        from,
        { text: `❌ ${errorDeApi}` },
        { quoted: msg }
      )
      return false
    }
  }
}
