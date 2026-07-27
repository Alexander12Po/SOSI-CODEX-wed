import axios from 'axios'

export default {
  command: ['denuncias', 'denuncia'],
  description: 'Consulta denuncias policiales registradas por DNI',
  exec: async ({ sock, from, msg, args }) => {
    const s_dni = args[0]

    // Validación de DNI (8 dígitos)
    if (!s_dni || !/^\d{8}$/.test(s_dni)) {
      await sock.sendMessage(
        from,
        { text: '❌ *Uso incorrecto.*\nDebes ingresar un DNI válido de 8 dígitos.\n\n*Ejemplo:* .denuncias 00000000' },
        { quoted: msg }
      )
      return false
    }

    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando denuncias registradas...' }, { quoted: msg })

      const { data: response } = await axios.get(`https://api-codart.cgrt.org/api/v1/consultas/fd/denuncias/${s_dni}`, {
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

      // Encabezado con el resumen
      let textoResumen = `┌─❐ *DENUNCIAS POLICIALES* ❐\n`
      textoResumen += `│\n`
      textoResumen += `│ 🆔 *DNI Consultado:* ${info.consulta}\n`
      textoResumen += `│ 🚨 *Total de Denuncias:* ${totalDenuncias}\n`
      textoResumen += `│\n`
      textoResumen += `└────────────`

      await sock.sendMessage(from, { text: textoResumen }, { quoted: msg })

      // Enviar cada denuncia con su detalle
      for (const denuncia of info.denuncias) {
        let detalle = `📋 *Denuncia N°${denuncia.numero}*\n`
        detalle += `• *Tipo:* ${denuncia.tipo}\n`
        detalle += `• *Comisaría:* ${denuncia.comisaria}\n`
        detalle += `• *N° Orden:* ${denuncia.n_orden}\n`
        detalle += `• *Fecha del hecho:* ${denuncia.f_hecho}\n`
        detalle += `• *Fecha de registro:* ${denuncia.f_registro}\n`

        // Verificar si el data_uri tiene contenido base64 real
        const tieneArchivo = denuncia.data_uri && denuncia.data_uri.includes(',') && denuncia.data_uri.split(',')[1]?.length > 0

        if (tieneArchivo) {
          const base64Data = denuncia.data_uri.split(',')[1]
          const buffer = Buffer.from(base64Data, 'base64')

          await sock.sendMessage(
            from,
            {
              document: buffer,
              mimetype: denuncia.mime || 'application/pdf',
              fileName: denuncia.nombre || `denuncia_${denuncia.numero}.pdf`,
              caption: detalle
            },
            { quoted: msg }
          )
        } else {
          detalle += `\n⚠️ _Documento no disponible para descarga._`
          await sock.sendMessage(from, { text: detalle }, { quoted: msg })
        }
      }

    } catch (err) {
      console.error('Error consultando Denuncias por DNI:', err?.response?.data || err.message)

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
