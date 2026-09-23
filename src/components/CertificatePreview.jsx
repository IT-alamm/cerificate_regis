import { QRCodeSVG } from 'qrcode.react'
import { fmt, buildQrPayload } from '../lib/store'

export default function CertificatePreview({ cert, orgLabel, body }) {
  const isDraft = cert.status === 'draft'
  // ROHS replaced with CCPL / Delano certification body
  const cb = (body || orgLabel || cert.body || 'CCPL').toUpperCase()
  const cbLower = cb.toLowerCase()
  // Draft: mask all dates. Final: real dates.
  const d = (v) => (isDraft ? 'XX/XX/XXXX' : fmt(v))

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
      {/* Left ribbon — SVG text (canvas/PDF-safe, writing-mode html2canvas me ulta aata hai) */}
      <div className="ribbon">
        <svg className="ribbon-text" viewBox="0 0 78 1000" preserveAspectRatio="xMidYMid meet" aria-label="QUALITY MANAGEMENT SYSTEM">
          <text transform="translate(39 500) rotate(-90)" textAnchor="middle" fontSize="44" fontWeight="800" fill="#e8c85a" fontFamily="Inter, Arial, sans-serif" textLength="860" lengthAdjust="spacingAndGlyphs">QUALITY MANAGEMENT SYSTEM</text>
        </svg>
        <div className="red-seal" />
      </div>

      <div className="cert-body">
        <div className="cert-script">Certificate of Registration</div>
        <div className="rohs-logo">
          <div className="rohs-globe">🌐</div>
          <div className="rohs-name">{cb}</div>
        </div>

        <p className="cert-line italic">This is to Certify That The Quality Management System of</p>
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
