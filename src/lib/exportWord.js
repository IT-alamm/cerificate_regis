import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, ImageRun,
  TextDirection, VerticalAlign, TableLayoutType,
} from 'docx'
import QRCode from 'qrcode'
import { fmt } from './store'

// Same base name for PDF + Word: "EAU/QMS/XXXX" -> "EAU_QMS_XXXX"
export const certFileBase = (no) =>
  String(no || 'certificate').replace(/[\\/:*?"<>|]/g, '_').trim() || 'certificate'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 800)
}

const T = (text, opts = {}) => new TextRun({ text: String(text ?? ''), ...opts })
const P = (children, opts = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], ...opts })
// px (screen) -> docx half-points
const hp = (px, fallback) => {
  const n = parseInt(px, 10)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1.5) : fallback
}
const NONE = { top: { style: 'none', size: 0, color: 'auto' }, bottom: { style: 'none', size: 0, color: 'auto' }, left: { style: 'none', size: 0, color: 'auto' }, right: { style: 'none', size: 0, color: 'auto' }, insideH: { style: 'none', size: 0, color: 'auto' }, insideV: { style: 'none', size: 0, color: 'auto' } }
const dateRow = (label, value) =>
  new TableRow({
    children: [
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: NONE, children: [P(T(label, { bold: true, size: 22 }))] }),
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: NONE, children: [P(T(`: ${value}`, { size: 22 }))] }),
    ],
  })

/* EDITABLE Word (.docx) — PDF jaisa layout, saara text editable:
   - Blue ribbon (vertical gold text, Word ka native vertical text)
   - Gold patti, gold title, dates table, verify line, QR, Chairman, IAF/EIACI
   Note: laal seal (circle graphic) Word me editable object nahi ban sakta — wo chhoda hai. */
export async function downloadWord(cert, bodyLabel, baseName) {
  const isDraft = cert.status === 'draft'
  const d = (v) => (isDraft ? 'XX/XX/XXXX' : fmt(v))
  const cb = String(bodyLabel || cert.body || 'CCPL').toUpperCase()
  const cbLower = cb.toLowerCase()
  const no = cert.certificate_no || 'XX-XXXX-XXX'
  const addrLines = String(cert.address || '').split('\n')
  const addrSize = hp(cert.address_size || cert.addrSize, 24)
  const addrBold = String(cert.address_bold ?? cert.addrBold ?? 'NO').toUpperCase() === 'YES'
  const scopeSize = hp(cert.scope_size || cert.scopeSize, 22)
  const scopeBold = String(cert.scope_bold ?? cert.scopeBold ?? 'NO').toUpperCase() === 'YES'
  const showSig = String(cert.show_signature || 'YES').toUpperCase() === 'YES'
  const verifyLine = cert.verify_line || `Verify this certificate at www.${cbLower}certification.co.in — Scan QR to verify`
  const qrText = cert.qr_value || no

  let qrBuf = null
  try {
    const url = await QRCode.toDataURL(String(qrText).slice(0, 800), { width: 220, margin: 1 })
    qrBuf = await (await fetch(url)).arrayBuffer()
  } catch { /* QR skip */ }

  const content = [
    P(T('Certificate of Registration', { bold: true, size: 56, color: 'B8860B' }), { alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
    P(T(cb, { bold: true, size: 24, color: '1A237E' }), { alignment: AlignmentType.CENTER }),
    P(T('This is to Certify That The Quality Management System of', { italics: true, size: 24 }), { alignment: AlignmentType.CENTER, spacing: { before: 160, after: 120 } }),
    P(T(cert.org_display || '—', { bold: true, size: 28 }), { alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
    ...addrLines.map((l) => P(T(l.toUpperCase(), { size: addrSize, bold: addrBold }), { alignment: AlignmentType.CENTER })),
    P(T('has been assessed and found to conform to the requirements of', { italics: true, size: 24 }), { alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 } }),
    P(T(cert.standard || 'ISO 9001:2015', { bold: true, size: 44, color: '283593' }), { alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
    P(T('for the following scope :', { italics: true, size: 24 }), { alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
    P(T(String(cert.scope || '—').toUpperCase(), { size: scopeSize, bold: scopeBold }), { alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NONE,
      rows: [
        dateRow('Certificate No', no),
        dateRow('Initial Registration Date', d(cert.initial_date)),
        dateRow('Date of Expiry*', d(cert.expiry_date)),
        dateRow('Issuance Date', d(cert.issue_date)),
        dateRow('1st Surve. Due', d(cert.surve1_due || cert.surve1)),
        dateRow('2nd Surve. Due', d(cert.surve2_due || cert.surve2)),
      ],
    }),
    P(T(verifyLine, { size: 20, color: '1A237E' }), { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 } }),
    ...(qrBuf ? [P(new ImageRun({ data: qrBuf, transformation: { width: 120, height: 120 }, type: 'png' }), { alignment: AlignmentType.CENTER }), P(T('Scan to verify', { size: 18, color: '666666' }), { alignment: AlignmentType.CENTER, spacing: { after: 200 } })] : []),
    // Neeche ek saath: Chairman (left) + IAF/EIACI (right)
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: NONE,
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE }, borders: NONE,
            children: [
              ...(showSig ? [P(T('Chairman', { size: 28, italics: true, color: '1A237E' }), {})] : []),
              P(T('CHAIRMAN', { bold: true, size: 22 }), {}),
              P(T(`${cb} Certification Pvt. Ltd.`, { bold: true, size: 22 }), { spacing: { after: 80 } }),
              P(T('408, Madhuban Building, 55 Nehru Place, New Delhi - 110 019, India', { size: 16, color: '444444' }), {}),
              P(T(`phone : +91-11-41525522 | e-mail : info@${cbLower}certification.co.in | website : www.${cbLower}certification.co.in`, { size: 16, color: '444444' }), {}),
            ],
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE }, borders: NONE, verticalAlign: VerticalAlign.BOTTOM,
            children: [
              P(T('IAF', { bold: true, size: 36, color: '1A56DB' }), { alignment: AlignmentType.CENTER }),
              P(T('Member of Multilateral Recognition Arrangement', { size: 14, color: '444444' }), { alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
              P(T('eiaci', { size: 36, color: '1A237E' }), { alignment: AlignmentType.CENTER }),
              P(T('Emirates International Accreditation Centre | 035-CB-QMS', { size: 14, color: '444444' }), { alignment: AlignmentType.CENTER }),
            ],
          }),
        ],
      })],
    }),
  ]

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 } }, // A4
        pageMargin: { top: 720, right: 720, bottom: 720, left: 720 },
      },
      children: [
        // Outer layout table: blue ribbon | gold strip | content — sab editable
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: NONE,
          rows: [new TableRow({
            children: [
              new TableCell({
                width: { size: 950, type: WidthType.DXA },
                shading: { fill: '1A237E' },
                textDirection: TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT,
                verticalAlign: VerticalAlign.CENTER,
                borders: NONE,
                children: [P(T('QUALITY MANAGEMENT SYSTEM', { bold: true, size: 30, color: 'E8C85A' }), { alignment: AlignmentType.CENTER })],
              }),
              new TableCell({
                width: { size: 110, type: WidthType.DXA },
                shading: { fill: 'C9A227' },
                borders: NONE,
                children: [P(T('', { size: 12 }))],
              }),
              new TableCell({
                width: { size: 9406, type: WidthType.DXA },
                borders: NONE,
                children: content,
              }),
            ],
          })],
        }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  triggerDownload(blob, `${baseName || certFileBase(no)}.docx`)
  return blob
}
