import axios from 'axios'

export default {
  command: ['dni'],
  description: 'Consulta datos detallados de una persona por su DNI (Perú)',
  exec: async ({ sock, from, msg, args }) => {
    const dni = args[0]

    // Validación de DNI (8 dígitos)
    if (!dni || !/^\d{8}$/.test(dni)) {
      await sock.sendMessage(
        from,
        { text: '❌ Debes ingresar un DNI válido de 8 dígitos.\n\nEjemplo: *.dni 12345678*' },
        { quoted: msg }
      )
      return false // 👈 Evita el cobro por error de formato
    }

    // Tu token directo
    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando información detallada...' }, { quoted: msg })

      // Petición a la nueva API
      const { data: response } = await axios.get(`https://api-codart.cgrt.org/api/v1/consultas/fd/dni/${dni}`, {
        timeout: 15000, // 👈 corta la espera a los 15s si la API no responde
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
          { text: '❌ No se encontraron resultados para ese DNI.' },
          { quoted: msg }
        )
        return false // 👈 Evita el cobro si el DNI no existe en la base de datos
      }

      const userData = response.data

      // Construcción del mensaje con TODOS los datos disponibles
      const text = `┌─❐ *DATOS DEL CIUDADANO* ❐
│
│ 🆔 *DNI:* ${userData.dni.completo}
│ 👤 *Nombres:* ${userData.nombres}
│ 👥 *Apellidos:* ${userData.apellidos}
│ ⚧️ *Género:* ${userData.genero}
│
│ 🎂 *Nacimiento:* ${userData.nacimiento.fecha} (${userData.nacimiento.edad})
│ 🌍 *Lugar Nac.:* ${userData.nacimiento.distrito}, ${userData.nacimiento.provincia}, ${userData.nacimiento.departamento}
│
│ 👨‍👦 *Padre:* ${userData.informacion_general.padre}
│ 👩‍👦 *Madre:* ${userData.informacion_general.madre}
│ 💍 *Estado Civil:* ${userData.informacion_general.estado_civil}
│ 🎓 *Educación:* ${userData.informacion_general.nivel_educativo}
│
│ 📍 *Dirección:* ${userData.domicilio.direccion}
│ 🗺️ *Residencia:* ${userData.domicilio.distrito}, ${userData.domicilio.provincia}, ${userData.domicilio.departamento}
│ 📌 *Ubigeo (RENIEC):* ${userData.ubigeos.reniec}
│
│ 📏 *Estatura:* ${userData.informacion_general.estatura}
│ ❤️ *Donante Órganos:* ${userData.informacion_general.donante_organos}
│ ⚠️ *Restricciones:* ${userData.informacion_general.restriccion}
│
│ 📅 *F. Inscripción:* ${userData.informacion_general.fecha_inscripcion}
│ 📅 *F. Emisión:* ${userData.informacion_general.fecha_emision}
│ ⏳ *F. Caducidad:* ${userData.informacion_general.fecha_caducidad}
│
└────────────`

      // Verificar si la API devolvió la imagen en Base64
      if (userData.images && userData.images.length > 0 && userData.images[0].data_uri) {
        // Extraer solo la parte base64 de la URI
        const base64Data = userData.images[0].data_uri.split(',')[1]
        const imageBuffer = Buffer.from(base64Data, 'base64')

        // Enviar imagen con el texto completo
        await sock.sendMessage(from, { image: imageBuffer, caption: text }, { quoted: msg })
      } else {
        // Si no hay imagen, solo enviar el texto
        await sock.sendMessage(from, { text }, { quoted: msg })
      }

    } catch (err) {
      console.error('Error consultando DNI:', err?.response?.data || err.message)
      const mensaje = err.code === 'ECONNABORTED'
        ? '⏱️ La consulta tardó demasiado y se canceló. Intenta de nuevo en unos segundos.'
        : '❌ Ocurrió un error al consultar. Verifica el número de DNI o si el servicio está disponible.'
      await sock.sendMessage(
        from,
        { text: mensaje },
        { quoted: msg }
      )
      return false // 👈 Evita el cobro si la API se cae o da error 500
    }
  }
}
