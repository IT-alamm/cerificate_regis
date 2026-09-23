import { useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { fmt, buildQrPayload } from '../lib/store'

/* Ribbon text canvas par khud draw hota hai — na kat sakta hai, na ulta ho sakta hai.
   Screen, PDF, Word-photo, print — har jagah same. measureText se fit guarantee. */
const SYSTEM_NAMES = {
  QMS: 'Quality Management System',
  FSMS: 'Food Safety Management System',
  EMS: 'Environmental Management System',
}
function RibbonLabel({ text }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const W = 156, H = 2000
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#e8c85a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const TEXT = text || 'QUALITY MANAGEMENT SYSTEM'
    let fs = 84
    const fits = () => {
      ctx.font = `800 ${fs}px Inter, Arial, sans-serif`
      return ctx.measureText(TEXT).width
    }
    while (fits() > H - 200 && fs > 16) fs -= 2
    ctx.font = `800 ${fs}px Inter, Arial, sans-serif`
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.rotate(-Math.PI / 2) // neeche se upar padhne wala text (original jaisa)
    ctx.fillText(TEXT, 0, 0)
    ctx.restore()
  }, [text])
  return <canvas ref={ref} className="ribbon-text" aria-label={text} />
}

export default function CertificatePreview({ cert, orgLabel, body }) {
  const isDraft = cert.status === 'draft'
  // ROHS replaced with CCPL / Delano certification body
  const cb = (body || orgLabel || cert.body || 'CCPL').toUpperCase()
  const cbLower = cb.toLowerCase()
  // Draft: mask all dates. Final: real dates.
  const d = (v) => (isDraft ? 'XX/XX/XXXX' : fmt(v))

  // Certificate type ke hisab se system name (QMS/FSMS/EMS)
  const certType = (cert.certificate_type || cert.type || 'QMS').toUpperCase()
  const systemName = SYSTEM_NAMES[certType] || SYSTEM_NAMES.QMS
  const ribbonText = systemName.toUpperCase()
  // Signature YES/NO option
  const showSig = String(cert.show_signature || 'YES').toUpperCase() === 'YES'
  // Verify line printed above signature
  const verifyLine = cert.verify_line || `Verify this certificate at www.${cbLower}certification.co.in — Scan QR to verify`
  // Address + Scope style: UPPERCASE, size just smaller than org name (19px), bold optional
  const addrSize = cert.address_size || cert.addrSize || '16'
  const addrBold = String(cert.address_bold ?? cert.addrBold ?? 'NO').toUpperCase() === 'YES'
  const scopeSize = cert.scope_size || cert.scopeSize || '15'
  const scopeBold = String(cert.scope_bold ?? cert.scopeBold ?? 'NO').toUpperCase() === 'YES'
  // QR value: custom if given, else compact JSON payload so scan reveals full data
  const qrValue = cert.qr_value || buildQrPayload({
    body: cb, certificate_no: cert.certificate_no,
    org_display: cert.org_display, standard: cert.standard,
    certificate_type: cert.certificate_type || cert.type,
    initial_date: cert.initial_date, issue_date: cert.issue_date,
    expiry_date: cert.expiry_date,
    surve1_due: cert.surve1_due || cert.surve1, surve2_due: cert.surve2_due || cert.surve2,
  })

  return (
    <div className="cert-sheet rohs">
      {/* Left ribbon — canvas-drawn text (kat/ulta hona impossible), red sticker hataya */}
      <div className="ribbon">
        <RibbonLabel text={ribbonText} />
      </div>

      <div className="cert-body">
        <div className="cert-script">Certificate of Registration</div>
        <div className="rohs-logo">
          <div className="rohs-globe">🌐</div>
          <div className="rohs-name">{cb}</div>
        </div>

        <p className="cert-line italic">This is to Certify That The {systemName} of</p>
        <h2 className="cert-cname">{cert.org_display || orgLabel || '—'}</h2>
        <div className="cert-addr" style={{ textTransform: 'uppercase', fontSize: `${addrSize}px`, fontWeight: addrBold ? '800' : '400' }}>{(cert.address || '').split('\n').map((l, i) => <div key={i}>{l}</div>)}</div>

        <p className="cert-line italic">has been assessed and found to conform to the requirements of</p>
        <div className="std">{cert.standard || 'ISO 9001:2015'}</div>
        <p className="cert-line italic">for the following scope :</p>

        <div className="scope-para" style={{ textTransform: 'uppercase', fontSize: `${scopeSize}px`, fontWeight: scopeBold ? '700' : '400' }}>{cert.scope || '—'}</div>

        <div className="cert-dates">
          <div className="cd-left">
            <div><b>Certificate No</b><span>: {isDraft ? (cert.certificate_no || 'XX-XXXX-XXX') : cert.certificate_no || '—'}</span></div>
            <div><b>Initial Registration Date</b><span>: {d(cert.initial_date)}</span></div>
            <div><b>Date of Expiry*</b><span>: {d(cert.expiry_date)}</span></div>
          </div>
          <div className="cd-right">
            <div><b>Issuance Date</b><span>: {d(cert.issue_date)}</span></div>
            <div><b>1st Surve. Due</b><span>: {d(cert.surve1_due || cert.surve1)}</span></div>
            <div><b>2nd Surve. Due</b><span>: {d(cert.surve2_due || cert.surve2)}</span></div>
          </div>
        </div>

        {/* Verify line + QR UPPAR */}
        <div className="verify-line">{verifyLine}</div>
        <div className="qr-top">
          <QRCodeSVG value={qrValue || 'verify'} size={80} />
          <small>Scan to verify</small>
        </div>

        {/* Signature + IAF sign EK SAATH NICHE */}
        <div className="cert-foot-row bottom-row">
          <div className="foot-left">
            {showSig ? (
              <div className="sign">Chairman</div>
            ) : (
              <div className="sign" style={{ visibility: 'hidden' }}>Chairman</div>
            )}
            <div className="director-label">CHAIRMAN<br /><b>{cb} Certification Pvt. Ltd.</b></div>
            <div className="foot-small">
              408, Madhuban Building, 55 Nehru Place, New Delhi - 110 019, India<br />
              phone : +91-11-41525522 | e-mail : info@{cbLower}certification.co.in | website : www.{cbLower}certification.co.in
            </div>
          </div>
          <div className="foot-badges">
            <div className="badge-iaf">IAF</div>
            <div className="badge-eiaci">eiac<span>I</span><small>Emirates International Accreditation Centre<br />035-CB-QMS</small></div>
          </div>
        </div>
      </div>
    </div>
  )
}
