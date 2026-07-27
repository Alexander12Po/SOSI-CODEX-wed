import axios from 'axios'

export default {
  command: ['dnit', 'dnitotal'],
  description: 'Consulta ficha completa de DNI con fotos (datos personales, domicilio, ubigeos)',
  exec: async ({ sock, from, msg, args }) => {
    const s_dni = args[0]

    // Validación de DNI (8 dígitos)
    if (!s_dni || !/^\d{8}$/.test(s_dni)) {
      await sock.sendMessage(
        from,
        { text: '❌ *Uso incorrecto.*\nDebes ingresar un DNI válido de 8 dígitos.\n\n*Ejemplo:* .dnit 00000000' },
        { quoted: msg }
      )
      return false
    }

    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando ficha completa de DNI...' }, { quoted: msg })

      const { data: response } = await axios.get(`https://api-codart.cgrt.org/api/v1/consultas/fd/dnit/${s_dni}`, {
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
          { text: '❌ No se encontró información para el DNI ingresado.' },
          { quoted: msg }
        )
        return false
      }

      const info = response.data
      const dni = info.dni || {}
      const nacimiento = info.nacimiento || {}
      const general = info.informacion_general || {}
      const domicilio = info.domicilio || {}
      const ubigeos = info.ubigeos || {}
      const images = info.images || []

      // Construcción del mensaje
      let text = `┌─❐ *FICHA COMPLETA DE DNI* ❐\n`
      text += `│\n`
      text += `│ 🆔 *DNI:* ${dni.completo || 'N/A'}\n`
      text += `│ 👤 *Nombres:* ${info.nombres || 'N/A'}\n`
      text += `│ 👤 *Apellidos:* ${info.apellidos || 'N/A'}\n`
      text += `│ ⚧️ *Género:* ${info.genero || 'N/A'}\n`
      text += `└────────────\n\n`

      text += `┌─ 🎂 *NACIMIENTO*\n`
      text += `│ • *Fecha:* ${nacimiento.fecha || 'N/A'} (${nacimiento.edad || 'N/A'})\n`
      text += `│ • *Departamento:* ${nacimiento.departamento || 'N/A'}\n`
      text += `│ • *Provincia:* ${nacimiento.provincia || 'N/A'}\n`
      text += `│ • *Distrito:* ${nacimiento.distrito || 'N/A'}\n`
      text += `└────────────\n\n`

      text += `┌─ 📋 *INFORMACIÓN GENERAL*\n`
      text += `│ • *Nivel Educativo:* ${general.nivel_educativo || 'N/A'}\n`
      text += `│ • *Estado Civil:* ${general.estado_civil || 'N/A'}\n`
      text += `│ • *Estatura:* ${general.estatura || 'N/A'}\n`
      text += `│ • *Fecha Inscripción:* ${general.fecha_inscripcion || 'N/A'}\n`
      text += `│ • *Fecha Emisión:* ${general.fecha_emision || 'N/A'}\n`
      text += `│ • *Fecha Caducidad:* ${general.fecha_caducidad || 'N/A'}\n`
      text += `│ • *Donante Órganos:* ${general.donante_organos || 'N/A'}\n`
      text += `│ • *Padre:* ${general.padre || 'N/A'}\n`
      text += `│ • *Madre:* ${general.madre || 'N/A'}\n`
      text += `│ • *Restricción:* ${general.restriccion || 'N/A'}\n`
      text += `└────────────\n\n`

      text += `┌─ 🏠 *DOMICILIO*\n`
      text += `│ • *Departamento:* ${domicilio.departamento || 'N/A'}\n`
      text += `│ • *Provincia:* ${domicilio.provincia || 'N/A'}\n`
      text += `│ • *Distrito:* ${domicilio.distrito || 'N/A'}\n`
      text += `│ • *Dirección:* ${domicilio.direccion || 'N/A'}\n`
      text += `└────────────\n\n`

      text += `┌─ 🗺️ *UBIGEOS*\n`
      text += `│ • *RENIEC:* ${ubigeos.reniec || 'N/A'}\n`
      text += `│ • *INE:* ${ubigeos.ine || 'N/A'}\n`
      text += `│ • *SUNAT:* ${ubigeos.sunat || 'N/A'}\n`
      text += `└────────────`

      // Filtrar solo imágenes que tengan contenido base64 real
      const imagenesValidas = images.filter(img => {
        return img.data_uri && img.data_uri.includes(',') && img.data_uri.split(',')[1]?.length > 0
      })

      if (imagenesValidas.length > 0) {
        // Enviar la primera imagen con el texto completo como caption
        const primeraImg = imagenesValidas[0]
        const base64Primera = primeraImg.data_uri.split(',')[1]
        const bufferPrimera = Buffer.from(base64Primera, 'base64')

        await sock.sendMessage(
          from,
          { image: bufferPrimera, caption: text },
          { quoted: msg }
        )

        // Enviar el resto de imágenes (si hay más de una) sin caption repetido
        for (let i = 1; i < imagenesValidas.length; i++) {
          const base64Data = imagenesValidas[i].data_uri.split(',')[1]
          const buffer = Buffer.from(base64Data, 'base64')
          await sock.sendMessage(from, { image: buffer }, { quoted: msg })
        }
      } else {
        // Si no hay imágenes válidas, solo enviamos el texto
        await sock.sendMessage(from, { text }, { quoted: msg })
      }

    } catch (err) {
      console.error('Error consultando DNI Total:', err?.response?.data || err.message)

      const errorDeApi = err?.response?.data?.message || 'Ocurrió un error inesperado al consultar el DNI.'

      await sock.sendMessage(
        from,
        { text: `❌ *Error en la consulta:*\n${errorDeApi}` },
        { quoted: msg }
      )
      return false
    }
  }
          }
