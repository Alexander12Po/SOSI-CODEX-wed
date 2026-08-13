import axios from 'axios'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

export default {
  command: ['ag', 'familia', 'arbol'],
  description: 'Consulta árbol genealógico y genera PDF visual',
  exec: async ({ sock, from, msg, args }) => {
    const s_dni = args[0]
    
    if (!s_dni || !/^\d{8}$/.test(s_dni)) {
      await sock.sendMessage(
        from,
        { text: ' Debes ingresar un DNI válido de 8 dígitos.\n\nEjemplo: *.ag 12345678*' },
        { quoted: msg }
      )
      return false
    }

    const token = 'jmdCRmBLZ13ITSmUGCWcBnDcTuOddttU7d0UbL8S7HJNelk8loSpnVkUyFJO'

    try {
      await sock.sendMessage(from, { text: '🌳 Generando árbol genealógico visual...' }, { quoted: msg })

      // ✅ RUTA CORREGIDA: /ag/ en lugar de /genealogico/
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
      const totalFamiliares = info.familiares

      if (totalFamiliares === 0 || info.relaciones.length === 0) {
        await sock.sendMessage(
          from,
          { text: `ℹ️ No se registraron familiares para el DNI: ${info.consulta}` },
          { quoted: msg }
        )
        return false
      }

      const pdfPath = await generarPDF(info, s_dni)

      await sock.sendMessage(
        from,
        { 
          document: fs.readFileSync(pdfPath),
          fileName: `Arbol_Genealogico_${s_dni}.pdf`,
          mimetype: 'application/pdf',
          caption: `✅ *Árbol Genealógico Generado*\n\n👥 *Familiares:* ${totalFamiliares}\n\n🕵️ *SOSICODEX*`
        },
        { quoted: msg }
      )

      fs.unlinkSync(pdfPath)

    } catch (err) {
      console.error('Error en árbol genealógico:', err?.response?.data || err.message)
      const errorDeApi = err.code === 'ECONNABORTED'
        ? '⏱️ La consulta tardó demasiado y se canceló.'
        : '❌ Ocurrió un error al consultar el árbol genealógico.'
      await sock.sendMessage(
        from,
        { text: errorDeApi },
        { quoted: msg }
      )
      return false
    }
  }
}

// Colores por tipo de relación
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
      margin: 40,
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
    const margin = 40
    const contentWidth = pageWidth - (margin * 2)

    // === MARCA DE AGUA SOSICODEX ===
    doc.save()
    doc.opacity(0.08)
    doc.fontSize(60).fillColor('#000000').text('SOSICODEX', 180, 350, { 
      align: 'center',
      width: 235,
      angle: 45
    })
    doc.restore()

    // === HEADER ===
    doc.rect(0, 0, pageWidth, 70).fill('#2C3E50')
    doc.fontSize(22).fillColor('#FFFFFF').font('Helvetica-Bold').text('FAMILIARES / ÁRBOL GENEALÓGICO', margin, 20, { align: 'left' })
    doc.fontSize(10).fillColor('#BDC3C7').font('Helvetica').text('Familia Nuclear y Extendida', margin, 48, { align: 'left' })

    // === INFO DEL CONSULTADO ===
    doc.moveDown(2)
    doc.fontSize(14).fillColor('#2C3E50').font('Helvetica-Bold').text('📋 Información de la Consulta', margin, doc.y)
    doc.moveDown(0.5)
    doc.fontSize(10).fillColor('#555555').font('Helvetica')
    doc.text(`DNI Consultado: ${info.consulta}    |    Familiares encontrados: ${info.familiares}    |    Fecha: ${new Date().toLocaleDateString('es-PE')}`, margin, doc.y)

    // === SECCIÓN: FAMILIARES ===
    doc.moveDown(2)
    doc.fontSize(14).fillColor('#2C3E50').font('Helvetica-Bold').text('👥 Detalle de Familiares', margin, doc.y)
    doc.moveDown(1)

    // === TARJETAS DE FAMILIARES ===
    const cardWidth = 110
    const cardHeight = 130
    const cardSpacing = 15
    const cardsPerRow = 4
    const startX = margin
    let currentX = startX
    let currentY = doc.y

    info.relaciones.forEach((familiar, index) => {
      if (currentX + cardWidth > pageWidth - margin) {
        currentX = startX
        currentY += cardHeight + cardSpacing
      }

      if (currentY + cardHeight > 780) {
        doc.addPage()
        currentY = 60
        currentX = startX
      }

      const color = getColorRelacion(familiar.relacion)

      // Barra de color superior
      doc.rect(currentX, currentY, cardWidth, 8).fill(color)
      
      // Cuerpo de la tarjeta
      doc.rect(currentX, currentY + 8, cardWidth, cardHeight - 8).fill('#FFFFFF').strokeColor('#E0E0E0').lineWidth(0.5).stroke()

      // Placeholder de foto
      const photoX = currentX + (cardWidth / 2) - 20
      const photoY = currentY + 20
      doc.circle(photoX + 20, photoY + 20, 20).fill('#F5F5F5').strokeColor(color).lineWidth(1).stroke()
      doc.fontSize(16).fillColor(color).text('👤', photoX + 12, photoY + 10, { width: 20, align: 'center' })

      // Nombre
      const nombreCompleto = `${familiar.nombres} ${familiar.apellidos}`
      const nombreCorto = nombreCompleto.length > 20 ? nombreCompleto.substring(0, 20) + '...' : nombreCompleto
      
      doc.fontSize(7).fillColor('#2C3E50').font('Helvetica-Bold').text(
        nombreCorto.toUpperCase(),
        currentX + 5,
        currentY + 70,
        { width: cardWidth - 10, align: 'center' }
      )

      // DNI
      doc.fontSize(6).fillColor('#7F8C8D').font('Helvetica').text(
        `DNI: ${familiar.dni}`,
        currentX + 5,
        currentY + 88,
        { width: cardWidth - 10, align: 'center' }
      )

      // Edad y Sexo
      doc.fontSize(6).fillColor('#7F8C8D').text(
        `Edad: ${familiar.edad} | ${familiar.sexo === 'MASCULINO' ? '♂' : '♀'}`,
        currentX + 5,
        currentY + 100,
        { width: cardWidth - 10, align: 'center' }
      )

      // Relación (badge)
      const relacionY = currentY + 115
      doc.rect(currentX + 10, relacionY, cardWidth - 20, 14).fill(color)
      doc.fontSize(6).fillColor('#FFFFFF').font('Helvetica-Bold').text(
        familiar.relacion.toUpperCase(),
        currentX + 10,
        relacionY + 3,
        { width: cardWidth - 20, align: 'center' }
      )

      // Verificación
      const verifColor = familiar.verificacion === 'ALTO' ? '#27AE60' : '#F39C12'
      doc.fontSize(6).fillColor(verifColor).text(
        `● ${familiar.verificacion}`,
        currentX + 5,
        currentY + 135,
        { width: cardWidth - 10, align: 'center' }
      )

      currentX += cardWidth + cardSpacing
    })

    // === LEYENDA ===
    doc.addPage()
    doc.fontSize(12).fillColor('#2C3E50').font('Helvetica-Bold').text(' Leyenda de Relaciones', margin, 60)
    doc.moveDown(1)

    const relacionesUnicas = [...new Set(info.relaciones.map(r => r.relacion))]
    let legendX = margin
    let legendYPos = doc.y

    relacionesUnicas.forEach((relacion) => {
      if (legendX + 100 > pageWidth - margin) {
        legendX = margin
        legendYPos += 20
      }

      const color = getColorRelacion(relacion)
      doc.rect(legendX, legendYPos, 12, 12).fill(color)
      doc.fontSize(8).fillColor('#333333').font('Helvetica').text(
        relacion,
        legendX + 16,
        legendYPos + 2,
        { width: 80 }
      )

      legendX += 100
    })

    // === NIVEL DE VERIFICACIÓN ===
    doc.moveDown(3)
    doc.fontSize(12).fillColor('#2C3E50').font('Helvetica-Bold').text('🔍 Nivel de Verificación', margin, doc.y)
    doc.moveDown(1)

    doc.circle(margin, doc.y + 5, 6).fill('#27AE60')
    doc.fontSize(9).fillColor('#333333').text('ALTO - Alta confianza', margin + 12, doc.y)

    doc.circle(margin + 120, doc.y - 5, 6).fill('#F39C12')
    doc.text('MEDIO - Parcial', margin + 132, doc.y - 5)

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