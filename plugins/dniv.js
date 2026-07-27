import axios from 'axios'

export default {
  command: ['dniv'],
  description: 'Consulta datos de DNI con imágenes en formato PNG',
  exec: async ({ sock, from, msg, args }) => {
    const s_dni = args[0]

    // Validación de DNI (8 dígitos)
    if (!s_dni || !/^\d{8}$/.test(s_dni)) {
      await sock.sendMessage(
        from,
        { text: '❌ *Uso incorrecto.*\nDebes ingresar un DNI válido de 8 dígitos.\n\n*Ejemplo:* .dniv 00000000' },
        { quoted: msg }
      )
      return false
    }

    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando datos de DNI...' }, { quoted: msg })

      const { data: response } = await axios.get(`https://api-codart.cgrt.org/api/v1/consultas/fd/dniv/${s_dni}`, {
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
      const images = info.images || []

      // Construcción del mensaje
      let text = `┌─❐ *CONSULTA DNI* ❐\n`
      text += `│\n`
      text += `│ 🆔 *DNI:* ${info.dni || 'N/A'}\n`
      text += `│ 👤 *Nombres:* ${info.nombres || 'N/A'}\n`
      text += `│ 👤 *Apellidos:* ${info.apellidos || 'N/A'}\n`
      text += `│ ⚧️ *Género:* ${info.genero || 'N/A'}\n`
      text += `│ 🎂 *Edad:* ${info.edad || 'N/A'} años\n`
      text += `│\n`
      text += `└────────────`

      // Filtrar solo imágenes con contenido base64 real
      const imagenesValidas = images.filter(img => {
        return img.data_uri && img.data_uri.includes(',') && img.data_uri.split(',')[1]?.length > 0
      })

      if (imagenesValidas.length > 0) {
        const primeraImg = imagenesValidas[0]
        const base64Primera = primeraImg.data_uri.split(',')[1]
        const bufferPrimera = Buffer.from(base64Primera, 'base64')

        await sock.sendMessage(
          from,
          { image: bufferPrimera, caption: text },
          { quoted: msg }
        )

        for (let i = 1; i < imagenesValidas.length; i++) {
          const base64Data = imagenesValidas[i].data_uri.split(',')[1]
          const buffer = Buffer.from(base64Data, 'base64')
          await sock.sendMessage(from, { image: buffer }, { quoted: msg })
        }
      } else {
        await sock.sendMessage(from, { text }, { quoted: msg })
      }

    } catch (err) {
      console.error('Error consultando DNI V:', err?.response?.data || err.message)

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
