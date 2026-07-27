import axios from 'axios'

export default {
  command: ['denpla', 'denuncias'],
  description: 'Consulta denuncias policiales registradas por número de placa',
  exec: async ({ sock, from, msg, args }) => {
    let placa = args[0]

    // Validación de placa (6 o 7 caracteres alfanuméricos)
    if (!placa || !/^[A-Za-z0-9]{6,7}$/.test(placa)) {
      await sock.sendMessage(
        from,
        { text: '❌ *Uso incorrecto.*\nDebes ingresar una placa válida (6 o 7 caracteres alfanuméricos).\n\n*Ejemplo:* .denpla D4G860' },
        { quoted: msg }
      )
      return false
    }

    // Limpiamos la placa: mayúsculas y sin símbolos raros
    placa = placa.toUpperCase().replace(/[^A-Z0-9]/g, '')

    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando denuncias registradas para esta placa...' }, { quoted: msg })

      const { data: response } = await axios.get(`https://api-codart.cgrt.org/api/v1/consultas/fd/denpla/${placa}`, {
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
          { text: '❌ No se encontró información de denuncias para la placa ingresada.' },
          { quoted: msg }
        )
        return false
      }

      const info = response.data
      const totalDenuncias = info.cantidad_denuncias

      if (totalDenuncias === 0 || info.denuncias.length === 0) {
        await sock.sendMessage(
          from,
          { text: `ℹ️ No se registraron denuncias para la placa: ${info.placa}` },
          { quoted: msg }
        )
        return false
      }

      // Encabezado con el resumen
      let textoResumen = `┌─❐ *DENUNCIAS POR PLACA* ❐\n`
      textoResumen += `│\n`
      textoResumen += `│ 🚗 *Placa:* ${info.placa}\n`
      textoResumen += `│ 🚨 *Total de Denuncias:* ${totalDenuncias}\n`
      textoResumen += `│\n`
      textoResumen += `└────────────`

      await sock.sendMessage(from, { text: textoResumen }, { quoted: msg })

      // Enviar cada denuncia como documento PDF (si trae data_uri con contenido)
      for (const denuncia of info.denuncias) {
        let detalle = `📋 *Denuncia N°${denuncia.numero}*\n`
        detalle += `• *Tipo:* ${denuncia.tipo}\n`
        detalle += `• *Comisaría:* ${denuncia.comisaria}\n`
        detalle += `• *N° Orden:* ${denuncia.n_orden}\n`
        detalle += `• *Fecha del hecho:* ${denuncia.f_hecho}\n`
        detalle += `• *Fecha de registro:* ${denuncia.f_registro}\n`

        // Verificar si el data_uri tiene contenido base64 real (no solo el prefijo vacío)
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
          // Si no hay archivo adjunto, solo mandamos el detalle en texto
          detalle += `\n⚠️ _Documento no disponible para descarga._`
          await sock.sendMessage(from, { text: detalle }, { quoted: msg })
        }
      }

    } catch (err) {
      console.error('Error consultando Denuncias por Placa:', err?.response?.data || err.message)

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
