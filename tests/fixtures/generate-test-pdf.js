/**
 * Generate Test PDF for Integration Tests
 * Creates a simple PDF file that simulates an RFP document
 */

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const fs = require('fs')
const path = require('path')

async function createTestPDF() {
  // Create a new PDFDocument
  const pdfDoc = await PDFDocument.create()

  // Add a page
  const page = pdfDoc.addPage([612, 792]) // Letter size
  const { width, height } = page.getSize()
  
  // Get font
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Add content
  let yPosition = height - 50

  // Title
  page.drawText('REQUEST FOR PROPOSAL (RFP)', {
    x: 50,
    y: yPosition,
    size: 18,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  })
  yPosition -= 30

  // RFP Number
  page.drawText('RFP No: TEST-2024-MED-001', {
    x: 50,
    y: yPosition,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 40

  // Project Title
  page.drawText('PROCUREMENT OF MEDICAL EQUIPMENT', {
    x: 50,
    y: yPosition,
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  })
  yPosition -= 30

  // Description
  const description = [
    'The Department of Veterans Affairs is seeking qualified vendors to provide',
    'advanced medical imaging equipment including MRI machines, CT scanners,',
    'and associated support services for multiple VA medical centers.',
  ]

  description.forEach(line => {
    page.drawText(line, {
      x: 50,
      y: yPosition,
      size: 11,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })
    yPosition -= 20
  })

  yPosition -= 20

  // Requirements Section
  page.drawText('REQUIREMENTS:', {
    x: 50,
    y: yPosition,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  })
  yPosition -= 20

  const requirements = [
    '1. FDA approved equipment only',
    '2. Minimum 5-year warranty on all equipment',
    '3. Installation and training services included',
    '4. 24/7 technical support availability',
    '5. HIPAA compliant data handling capabilities',
    '6. Energy Star certified where applicable',
  ]

  requirements.forEach(req => {
    page.drawText(req, {
      x: 70,
      y: yPosition,
      size: 11,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })
    yPosition -= 20
  })

  yPosition -= 20

  // Evaluation Criteria
  page.drawText('EVALUATION CRITERIA:', {
    x: 50,
    y: yPosition,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  })
  yPosition -= 20

  const criteria = [
    'Technical Capability (40%)',
    'Past Performance (25%)',
    'Price (20%)',
    'Small Business Participation (15%)',
  ]

  criteria.forEach(criterion => {
    page.drawText(`• ${criterion}`, {
      x: 70,
      y: yPosition,
      size: 11,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })
    yPosition -= 20
  })

  yPosition -= 20

  // Submission Details
  page.drawText('SUBMISSION DEADLINE:', {
    x: 50,
    y: yPosition,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  })
  yPosition -= 20

  page.drawText('March 15, 2024 at 2:00 PM EST', {
    x: 50,
    y: yPosition,
    size: 11,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  })

  // Add a second page with more content
  const page2 = pdfDoc.addPage([612, 792])
  yPosition = height - 50

  page2.drawText('TECHNICAL SPECIFICATIONS', {
    x: 50,
    y: yPosition,
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  })
  yPosition -= 30

  const specs = [
    'MRI Scanner Requirements:',
    '- 3.0 Tesla magnetic field strength minimum',
    '- Advanced cardiac imaging capabilities',
    '- Pediatric imaging protocols',
    '',
    'CT Scanner Requirements:',
    '- 64-slice minimum',
    '- Dual-energy capability',
    '- Dose reduction technology',
    '',
    'Service Requirements:',
    '- Response time: 4 hours for critical issues',
    '- Preventive maintenance quarterly',
    '- Remote diagnostics capability',
  ]

  specs.forEach(spec => {
    const fontSize = spec.startsWith('-') || spec.startsWith(' ') ? 10 : 11
    const xPos = spec.startsWith('-') || spec.startsWith(' ') ? 70 : 50
    
    page2.drawText(spec, {
      x: xPos,
      y: yPosition,
      size: fontSize,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    })
    yPosition -= 18
  })

  // Save the PDF
  const pdfBytes = await pdfDoc.save()
  const outputPath = path.join(__dirname, 'test-rfp.pdf')
  fs.writeFileSync(outputPath, pdfBytes)
  
  console.log(`Test PDF created at: ${outputPath}`)
}

// Generate the PDF
createTestPDF().catch(console.error)