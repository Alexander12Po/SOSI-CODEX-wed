import axios from 'axios'

export default {
  command: ['rqh', 'requisitorias'],
  description: 'Consulta requisitorias, órdenes de captura y procesos judiciales de una persona por su DNI',
  exec: async ({ sock, from, msg, args }) => {
    const s_dni = args[0]

    // Validación de DNI (8 dígitos)
    if (!s_dni || !/^\d{8}$/.test(s_dni)) {
      await sock.sendMessage(
        from,
        { text: '❌ *Uso incorrecto.*\nDebes ingresar un DNI válido de 8 dígitos.\n\n*Ejemplo:* .rqh 77137925' },
        { quoted: msg }
      )
      return false
    }

    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando requisitorias y procesos judiciales...' }, { quoted: msg })

      const { data: response } = await axios.get(`https://api-codart.cgrt.org/api/v1/consultas/fd/rqh/${s_dni}`, {
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
      const datos = info.datos_personales || {}
      const resumen = info.resumen_requisitorias || {}
      const detalle = info.detalle || []
      const documentos = info.documentos || []

      if (!info.cantidad_requisitorias || info.cantidad_requisitorias === 0) {
        await sock.sendMessage(
          from,
          { text: `ℹ️ No se registraron requisitorias para el DNI: ${info.consulta}` },
          { quoted: msg }
        )
        return false
      }

      // Encabezado con datos personales
      let text = `┌─❐ *REQUISITORIAS* ❐\n`
      text += `│\n`
      text += `│ 🆔 *DNI:* ${datos.dni || 'N/A'}\n`
      text += `│ 👤 *Nombres:* ${datos.nombres || 'N/A'}\n`
      text += `│ ⚧️ *Sexo:* ${datos.sexo || 'N/A'}\n`
      text += `│ 🎂 *Nacimiento:* ${datos.fecha_nacimiento || 'N/A'} (${datos.edad || 'N/A'} años)\n`
      text += `│ 💍 *Estado Civil:* ${datos.estado_civil || 'N/A'}\n`
      text += `│ 📏 *Estatura:* ${datos.estatura || 'N/A'} m\n`
      text += `│ 💼 *Ocupación:* ${datos.ocupacion || 'N/A'}\n`
      text += `│ 🏠 *Dirección:* ${datos.direccion || 'N/A'}\n`
      text += `│ 📍 *Distrito:* ${datos.distrito || 'N/A'}\n`
      text += `│ 🗺️ *Ubigeo:* ${datos.ubigeo || 'N/A'}\n`
      text += `└────────────\n\n`

      text += `┌─ 🚨 *RESUMEN DE REQUISITORIAS*\n`
      text += `│ 📊 *Total:* ${resumen.total || 0}\n`
      text += `│ 🔴 *Activas:* ${resumen.activas || 0}\n`
      text += `│ ⚪ *Inactivas:* ${resumen.inactivas || 0}\n`
      text += `└────────────\n\n`

      // Detalle de cada requisitoria
      detalle.forEach((r) => {
        const emoji = r.estado === 'ACTIVA' ? '🔴' : '⚪'
        text += `${emoji} *Requisitoria N°${r.numero} (${r.estado})*\n`
        text += `• *Tipo:* ${r.tipo || 'N/A'}\n`
        text += `• *Proceso:* ${r.proceso || 'N/A'}\n`
        text += `• *Motivo:* ${r.motivo || 'N/A'}\n`
        text += `• *Delito:* ${r.delito || 'N/A'}\n`
        text += `• *Año:* ${r.anio || 'N/A'}\n`
        text += `• *Cuaderno:* ${r.cuaderno || 'N/A'}\n`
        text += `• *Expediente:* ${r.exp || 'N/A'}\n`
        text += `• *N° Requisitoria:* ${r.nrq || 'N/A'}\n`
        text += `• *Inicio:* ${r.inicio || 'N/A'}\n`
        text += `• *Vence:* ${r.vence || 'N/A'}\n`
        text += `• *Secretario:* ${r.secretario || 'N/A'}\n`
        text += `• *Dependencia:* ${r.dependencia || 'N/A'}\n`
        text += `• *Distrito Judicial:* ${r.distrito || 'N/A'}\n`
        text += `─────────────────\n`
      })

      await sock.sendMessage(from, { text: text.trim() }, { quoted: msg })

      // Enviar documentos PDF adjuntos (si tienen contenido real)
      for (const doc of documentos) {
        const tieneArchivo = doc.data_uri && doc.data_uri.includes(',') && doc.data_uri.split(',')[1]?.length > 0

        if (tieneArchivo) {
          const base64Data = doc.data_uri.split(',')[1]
          const buffer = Buffer.from(base64Data, 'base64')

          await sock.sendMessage(
            from,
            {
              document: buffer,
              mimetype: doc.mime || 'application/pdf',
              fileName: doc.nombre || `requisitoria_${doc.numero}.pdf`,
              caption: `📄 Documento ${doc.numero}`
            },
            { quoted: msg }
          )
        }
      }

    } catch (err) {
      console.error('Error consultando Requisitorias:', err?.response?.data || err.message)

      const errorDeApi = err?.response?.data?.message || 'Ocurrió un error inesperado al consultar las requisitorias.'

      await sock.sendMessage(
        from,
        { text: `❌ *Error en la consulta:*\n${errorDeApi}` },
        { quoted: msg }
      )
      return false
    }
  }
          }
