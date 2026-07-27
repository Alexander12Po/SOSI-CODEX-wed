import axios from 'axios'

export default {
  command: ['telpx'],
  description: 'Consulta datos del titular de un número de celular',
  exec: async ({ sock, from, msg, args }) => {
    const numero = args[0]
    
    // Validación de número de celular (9 dígitos, empieza con 9)
    if (!numero || !/^\d{9}$/.test(numero)) {
      await sock.sendMessage(
        from,
        { text: '❌ Debes ingresar un número de celular válido de 9 dígitos.\n\nEjemplo: *.telpx 900000001*' },
        { quoted: msg }
      )
      return false // Evita cobros por formato incorrecto
    }

    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🔎 Consultando titular del número...' }, { quoted: msg })

      // Petición a la API con los Headers correctos
      const { data: response } = await axios.get(
        `https://api-codart.cgrt.org/api/v1/consultas/fd/telp/cel/${numero}`,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      )

      // Verificar si la consulta fue exitosa y hay datos
      if (!response.success || !response.data || response.data.titulares_encontrados === 0) {
        await sock.sendMessage(
          from,
          { text: '❌ No se encontraron titulares asociados a este número.' },
          { quoted: msg }
        )
        return false // Evita cobros si no hay resultados
      }

      // Construcción del mensaje con TODOS los datos del JSON
      let resultado = `┌─❐ *DATOS DEL TITULAR* ❐\n`
      resultado += `│\n`
      resultado += `📱 *Total encontrados:* ${response.data.titulares_encontrados}\n`
      resultado += `│\n`
      
      response.data.titulares.forEach((item, index) => {
        resultado += `├─ *${index + 1}.* 👤 Titular: ${item.titular || 'N/A'}\n`
        resultado += `│  📞 Teléfono: ${item.telefono || 'N/A'}\n`
        resultado += `│  🆔 DNI/RUC: ${item.dni_ruc || 'N/A'}\n`
        resultado += `│  🏢 Operador: ${item.operador || 'N/A'}\n`
        resultado += `│  🏢 Empresa: ${item.empresa || 'N/A'}\n`
        resultado += `│  📦 Plan: ${item.plan || 'N/A'}\n`
        resultado += `│  📧 Correo: ${item.correo || 'N/A'}\n`
        resultado += `│\n`
      })
      
      resultado += `└────────────`

      await sock.sendMessage(from, { text: resultado }, { quoted: msg })

    } catch (err) {
      console.error('Error consultando titular:', err?.response?.data || err.message)
      await sock.sendMessage(
        from,
        { text: '❌ Ocurrió un error al consultar. Verifica el número o si el servicio está disponible.' },
        { quoted: msg }
      )
      return false // Evita cobros si la API falla
    }
  }
}
