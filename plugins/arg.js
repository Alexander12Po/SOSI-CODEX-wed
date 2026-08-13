import axios from 'axios'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

export default {
  command: ['ag', 'familia', 'arbol'],
  description: 'Consulta árbol genealógico y genera PDF',
  exec: async ({ sock, from, msg, args }) => {
    const s_dni = args[0]
    
    if (!s_dni || !/^\d{8}$/.test(s_dni)) {
      await sock.sendMessage(
        from,
        { text: '❌ Debes ingresar un DNI válido de 8 dígitos.\n\nEjemplo: *.ag 12345678*' },
        { quoted: msg }
      )
      return false
    }

    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🌳 Generando árbol genealógico...' }, { quoted: msg })

      const { data: response } = await axios.get(
        `https://api-codart.cgrt.org/api/v1/consultas/fd/ag/${s_dni}`,
        {
          timeout: 15000,
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      )

      if (!response.success || !response.data || !response.data.relaciones) {
        await sock.sendMessage(
          from,
          { text: '❌ No se encontraron datos familiares para el DNI ingresado.' },
          { quoted: msg }
        )
        return false
      }

      const info = response.data
      const pdfPath = await generarPDF(info, s_dni)

      await sock.sendMessage(
        from,
        { 
          document: fs.readFileSync(pdfPath),
          fileName: `Arbol_Genealogico_${s_dni}.pdf`,
          mimetype: 'application/pdf',
          caption: `✅ *Árbol Genealógico Generado*\n\n👥 *Familiares:* ${info.familiares}\n\n️ *SOSICODEX*`
        },
        { quoted: msg }
      )

      fs.unlinkSync(pdfPath)

    } catch (err) {
      console.error('Error en árbol genealógico:', err?.response?.data || err.message)
      await sock.sendMessage(
        from,
        { text: '❌ Ocurrió un error al consultar.' },
        { quoted: msg }
      )
      return false
    }
  }
}

const coloresRelacion = {
  'PADRE': '#4A90E2',
  'MADRE': '#50C878',
  'HIJO': '#FF6B6B',
  'HIJA': '#FF6B9D',
  'HERMANO': '#9B59B6',
  'HERMANA': '#E91E8C',
  'ABUELO': '#8B7355',
  'ABUELA': '#A0826D',
  'TIO PATERNO': '#FF8C42',
  'TIA PATERNA': '#FF9E6B',
  'TIO MATERNO': '#FF8C42',
  'TIA MATERNA': '#FF9E6B',
  'PRIMO PATERNO': '#95A5A6',
  'PRIMA PATERNO': '#B0BEC5',
  'PRIMO MATERNO': '#95A5A6',
  'PRIMA MATERNO': '#B0BEC5',
  'SOBRINO': '#3498DB',
  'SOBRINA': '#5DADE2',
  'HIJASTRO': '#E74C3C',
  'HIJASTRA': '#EC7063',
  'CUÑADO': '#1ABC9C',
  'CUÑADA': '#48C9B0',
  'PAREJA': '#9B59B6',
  'default': '#7F8C8D'
}

function getColorRelacion(relacion) {
  const key = relacion.toUpperCase().replace(/\s+/g, ' ').trim()
  return coloresRelacion[key] || coloresRelacion.default
}

async function generarPDF(info, dni) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50,
      info: {
        Title: `Árbol Genealógico - ${dni}`,
        Author: 'SOSICODEX',
        Subject: 'Familiares'
      }
    })

    const filePath = path.join('/tmp', `arbol_${dni}_${Date.now()}.pdf`)
    const writeStream = fs.createWriteStream(filePath)
    
    doc.pipe(writeStream)

    const pageWidth = 595
    const margin = 50
    const contentWidth = pageWidth - (margin * 2)

    // === MARCA DE AGUA ===
    doc.save()
    doc.opacity(0.05)
    doc.fontSize(50).fillColor('#000000').text('SOSICODEX', 150, 400, { 
      align: 'center',
      width: 295,
      angle: 45
    })
    doc.restore()

    // === HEADER ===
    doc.rect(0, 0, pageWidth, 80).fill('#2C3E50')
    doc.fontSize(20).fillColor('#FFFFFF').font('Helvetica-Bold').text('FAMILIARES / ÁRBOL GENEALÓGICO', margin, 20, { align: 'left' })
    doc.fontSize(9).fillColor('#BDC3C7').font('Helvetica').text('Familia Nuclear y Extendida', margin, 48, { align: 'left' })

    // === INFO CONSULTA ===
    doc.moveDown(2)
    const fecha = new Date().toLocaleDateString('es-PE')
    doc.fontSize(10).fillColor('#555555').font('Helvetica')
    doc.text(`DNI Consultado: ${info.consulta}  |  Familiares: ${info.familiares}  |  Fecha: ${fecha}`, margin, doc.y)

    // === TABLA DE FAMILIARES ===
    doc.moveDown(1.5)
    doc.fontSize(12).fillColor('#2C3E50').font('Helvetica-Bold').text('📋 Detalle de Familiares', margin, doc.y)
    doc.moveDown(1)

    const tableStartY = doc.y
    const colWidths = [90, 140, 140, 50, 60, 55]
    const headers = ['DNI', 'Nombres', 'Apellidos', 'Edad', 'Sexo', 'Relación']
    const rowHeight = 28

    // Header tabla
    doc.rect(margin, tableStartY, contentWidth, rowHeight).fill('#2C3E50')
    doc.fontSize(8).fillColor('#FFFFFF').font('Helvetica-Bold')
    
    let xPos = margin + 5
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableStartY + 8, { width: colWidths[i] - 10, align: 'center' })
      xPos += colWidths[i]
    })

    // Filas de datos
    doc.font('Helvetica')
    info.relaciones.forEach((familiar, index) => {
      const yPos = tableStartY + ((index + 1) * rowHeight)
      
      // Fondo alternado
      if (index % 2 === 0) {
        doc.rect(margin, yPos, contentWidth, rowHeight).fill('#F8F9FA')
      }

      // Línea separadora
      doc.moveTo(margin, yPos + rowHeight)
         .lineTo(pageWidth - margin, yPos + rowHeight)
         .strokeColor('#E0E0E0').lineWidth(0.5).stroke()

      // Datos completos
      doc.fontSize(7.5).fillColor('#333333')
      
      const sexoAbrev = familiar.sexo === 'MASCULINO' ? 'M' : 'F'
      const verifColor = familiar.verificacion === 'ALTO' ? '#27AE60' : '#F39C12'
      
      // DNI
      doc.text(familiar.dni, margin + 5, yPos + 8, { width: colWidths[0] - 10, align: 'center' })
      
      // Nombres (completos)
      doc.text(familiar.nombres, margin + 95, yPos + 8, { width: colWidths[1] - 10, align: 'left' })
      
      // Apellidos (completos)
      doc.text(familiar.apellidos, margin + 235, yPos + 8, { width: colWidths[2] - 10, align: 'left' })
      
      // Edad
      doc.text(familiar.edad.toString(), margin + 375, yPos + 8, { width: colWidths[3] - 10, align: 'center' })
      
      // Sexo
      doc.text(sexoAbrev, margin + 425, yPos + 8, { width: colWidths[4] - 10, align: 'center' })
      
      // Relación (con color)
      const colorRel = getColorRelacion(familiar.relacion)
      doc.fillColor(colorRel).text(familiar.relacion.toUpperCase(), margin + 475, yPos + 8, { 
        width: colWidths[5] - 10, 
        align: 'center' 
      })
      doc.fillColor('#333333')
    })

    // === LEYENDA VERIFICACIÓN ===
    const legendY = tableStartY + ((info.relaciones.length + 1) * rowHeight) + 40
    doc.fontSize(10).fillColor('#2C3E50').font('Helvetica-Bold').text('🔍 Nivel de Verificación:', margin, legendY)
    
    doc.circle(margin + 160, legendY + 5, 5).fill('#27AE60')
    doc.fontSize(8).fillColor('#333333').font('Helvetica').text('ALTO - Alta confianza', margin + 170, legendY + 3)
    
    doc.circle(margin + 280, legendY + 5, 5).fill('#F39C12')
    doc.text('MEDIO - Parcial', margin + 290, legendY + 3)

    // === FOOTER ===
    doc.moveTo(margin, 800).lineTo(pageWidth - margin, 800).strokeColor('#BDC3C7').lineWidth(0.5).stroke()
    doc.fontSize(7).fillColor('#95A5A6').font('Helvetica').text(
      'Generado por SOSICODEX ️ - Documento informativo y confidencial',
      margin,
      808,
      { align: 'center', width: contentWidth }
    )

    doc.end()

    writeStream.on('finish', () => resolve(filePath))
    writeStream.on('error', reject)
  })
}