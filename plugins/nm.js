import axios from 'axios'

export default {
  command: ['nm', 'mn'],
  description: 'Busca personas por Nombres y Apellidos',
  exec: async ({ sock, from, msg, args }) => {
    
    const text = args.join(' ')

    // Verificar si el usuario ingresó texto
    if (!text) {
      await sock.sendMessage(
        from,
        { text: '❌ *Uso incorrecto.*\nPor favor, ingresa los nombres y apellidos separados por "|".\n\n*Ejemplo:*\n.nm Alexander|Huaman|Ramos' },
        { quoted: msg }
      )
      return false
    }

    // Separar los argumentos usando "|"
    let [n1, ap1, ap2] = text.split('|')

    // Validar que se hayan proporcionado los tres parámetros
    if (!n1 || !ap1 || !ap2) {
      await sock.sendMessage(
        from,
        { text: '⚠️ *Formato incompleto.*\nAsegúrate de incluir Nombre, Apellido Paterno y Apellido Materno separados por el carácter "|".\n\n*Ejemplo:*\n.nm Alexander|Huaman|Ramos' },
        { quoted: msg }
      )
      return false
    }

    // 💡 EL TRUCO ESTÁ AQUÍ 💡
    // Extraemos solo la PRIMERA palabra del nombre.
    // Si ponen "Alexander Paul" o "Alexander,Paul", el bot solo tomará "Alexander"
    let soloPrimerNombre = n1.trim().split(/[\s,]+/)[0] 
    let apellidoPaterno = ap1.trim()
    let apellidoMaterno = ap2.trim()

    // Tu token directo
    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'
    
    // Inyectamos el nombre ya limpio a la URL
    const url = `https://api-codart.cgrt.org/api/v1/consultas/fd/nm?n1=${encodeURIComponent(soloPrimerNombre)}&ap1=${encodeURIComponent(apellidoPaterno)}&ap2=${encodeURIComponent(apellidoMaterno)}`

    try {
      await sock.sendMessage(from, { text: '⏳ Consultando a la base de datos...' }, { quoted: msg })

      const { data: response } = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      // Verificar si la consulta fue exitosa
      if (!response.success || !response.data || !response.data.resultados) {
        await sock.sendMessage(
          from,
          { text: '❌ Error en la API o no se encontraron resultados.' },
          { quoted: msg }
        )
        return false
      }

      // Extraer los datos
      let cantidad = response.data.cantidad_resultados
      let resultados = response.data.resultados

      if (cantidad === 0 || resultados.length === 0) {
        await sock.sendMessage(
          from,
          { text: `ℹ️ No se encontró ninguna persona con los datos: ${soloPrimerNombre} ${apellidoPaterno} ${apellidoMaterno}` },
          { quoted: msg }
        )
        return false
      }

      // Construir el mensaje de respuesta
      let mensaje = `✅ *RESULTADOS ENCONTRADOS (${cantidad})*\n\n`

      resultados.forEach((resultado, index) => {
        mensaje += `👤 *Persona ${index + 1}*\n`
        mensaje += `*DNI:* ${resultado.dni}\n`
        mensaje += `*Nombres:* ${resultado.nombres}\n`
        mensaje += `*Apellidos:* ${resultado.apellidos}\n`
        mensaje += `*Edad:* ${resultado.edad} años\n`
        mensaje += `─────────────────\n`
      })

      await sock.sendMessage(from, { text: mensaje.trim() }, { quoted: msg })

    } catch (err) {
      // Manejo de errores detallado por si la API sigue quejándose
      const errorDeApi = err?.response?.data?.message || err?.response?.data?.errors?.n1?.[0] || 'Ocurrió un error inesperado al realizar la consulta.'
      
      console.error('Error en el comando nm:', err?.response?.data || err.message)
      
      await sock.sendMessage(
        from,
        { text: `❌ *Error en la consulta:*\n${errorDeApi}\n\n💡 *Sugerencia:* Revisa que no haya símbolos extraños.` },
        { quoted: msg }
      )
      return false
    }
  }
}
