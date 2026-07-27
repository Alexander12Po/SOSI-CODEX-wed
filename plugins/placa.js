import axios from 'axios'

export default {
  command: ['placa', 'vehiculo', 'auto'],
  description: 'Consulta información de un vehículo por su número de placa',
  exec: async ({ sock, from, msg, args }) => {
    let placa = args[0]

    // Validación básica de que ingresó un texto
    if (!placa) {
      await sock.sendMessage(
        from,
        { text: '❌ *Uso incorrecto.*\nDebes ingresar un número de placa válido.\n\n*Ejemplo:* .placa D5G960' },
        { quoted: msg }
      )
      return false
    }

    // Limpiamos la placa: la pasamos a mayúsculas y quitamos guiones por si el usuario escribe "D5G-960"
    placa = placa.toUpperCase().replace(/[^A-Z0-9]/g, '')

    // Tu token directo
    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando información del vehículo...' }, { quoted: msg })

      // Petición a la API de Placas
      const { data: response } = await axios.get(`https://api-codart.cgrt.org/api/v1/consultas/fd/pla/${placa}`, {
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
          { text: '❌ No se encontró información para la placa ingresada o no existe.' },
          { quoted: msg }
        )
        return false
      }

      const info = response.data

      // Construcción del texto que acompañará a la imagen
      let text = `┌─❐ *CONSULTA DE VEHÍCULO* ❐\n`
      text += `│\n`
      text += `│ 🚗 *Placa:* ${info.placa}\n`
      text += `│ 📸 *Imagen de la boleta generada con éxito*\n`
      text += `│\n`
      text += `└────────────`

      // Verificar si la API devolvió la imagen en Base64
      if (info.images && info.images.length > 0 && info.images[0].data_uri) {
        
        // Extraer solo la parte base64 de la URI (eliminando el "data:image/jpeg;base64,")
        const base64Data = info.images[0].data_uri.split(',')[1]
        
        // Convertir el base64 a un Buffer legible por WhatsApp
        const imageBuffer = Buffer.from(base64Data, 'base64')

        // Enviar la imagen con el texto como descripción (caption)
        await sock.sendMessage(from, { image: imageBuffer, caption: text }, { quoted: msg })
        
      } else {
        // Si por alguna razón la API no manda imagen, solo enviamos el texto
        await sock.sendMessage(from, { text: text }, { quoted: msg })
      }

    } catch (err) {
      console.error('Error consultando Placa:', err?.response?.data || err.message)
      
      const errorDeApi = err?.response?.data?.message || 'Ocurrió un error inesperado al consultar la placa.'
      
      await sock.sendMessage(
        from,
        { text: `❌ *Error en la consulta:*\n${errorDeApi}` },
        { quoted: msg }
      )
      return false
    }
  }
}
