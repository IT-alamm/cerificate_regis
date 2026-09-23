import { useEffect, useMemo, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import CertificatePreview from './components/CertificatePreview'
import {
  seed, getOrgs, getCerts, setCerts, orgNameById, orgIdByName,
  STD_MAP, uid, fmt, bump, buildQrPayload, parseQrPayload,
} from './lib/store'
import { downloadWord, certFileBase } from './lib/exportWord'

const emptyForm = {
  editId: '', org: 'CCPL', orgName: '', address: '',
  type: 'QMS', standard: STD_MAP.QMS, scope: '',
  iaf: '', certNo: '', version: 'v1',
  initial: '', issue: '', expiry: '', surve1: '', surve2: '', status: 'draft',
  showSig: 'YES', verifyLine: '', qrValue: '',
  addrSize: '16', addrBold: 'NO', scopeSize: '15', scopeBold: 'NO',
}

export default function App() {
  const [orgs, setOrgs] = useState([])
  const [certs, setCertState] = useState([])
  const [view, setView] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fOrg, setFOrg] = useState('')
  const [fType, setFType] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [step, setStep] = useState(1)
  // Verify (QR scan) state
  const [verifyNo, setVerifyNo] = useState('')
  const [verifyQr, setVerifyQr] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)
  const [verifyMsg, setVerifyMsg] = useState('')

  useEffect(() => { seed(); setOrgs(getOrgs()); setCertState(getCerts()) }, [])
  const persist = (c) => { setCerts(c); setCertState(c) }
  const set = (k, v) => setForm((f) => {
    if (k === 'type') return { ...f, type: v, standard: STD_MAP[v] || f.standard }
    return { ...f, [k]: v }
  })

  const drafts = certs.filter((c) => c.status === 'draft').length
  const finals = certs.filter((c) => c.status === 'final').length
  const ccplCount = certs.filter((c) => orgNameById(orgs, c.organization_id) === 'CCPL').length
  const delCount = certs.filter((c) => orgNameById(orgs, c.organization_id) === 'Delano').length

  const startCreate = (org, type) => {
    setForm({
      ...emptyForm,
      org: org || 'CCPL',
      type: type || 'QMS',
      standard: STD_MAP[type || 'QMS'],
    })
    setStep(type ? 3 : org ? 2 : 1)
    setView('create')
  }

  const editCert = (id) => {
    const r = certs.find((x) => x.id === id)
    if (!r) return
    if (r.status === 'final' && !confirm('Final certificate — editing will create a new version. Continue?')) return
    setForm({
      editId: r.id, org: orgNameById(orgs, r.organization_id),
      orgName: r.org_display || '', address: r.address || '',
      type: r.certificate_type, standard: r.standard, scope: r.scope || '',
      iaf: r.iaf_code || '', certNo: r.certificate_no || '', version: r.version || 'v1',
      initial: r.initial_date || '', issue: r.issue_date || '', expiry: r.expiry_date || '',
      surve1: r.surve1_due || r.surve1 || '', surve2: r.surve2_due || r.surve2 || '',
      status: r.status,
      showSig: r.show_signature || 'YES', verifyLine: r.verify_line || '', qrValue: r.qr_value || '',
      addrSize: r.address_size || '16', addrBold: r.address_bold || 'NO',
      scopeSize: r.scope_size || '15', scopeBold: r.scope_bold || 'NO',
    })
    setStep(3); setView('create')
  }

  // Save par Word + PDF dono ek saath, ek hi naam se download honge
  const saveCert = async (status) => {
    if (!form.address.trim()) return alert('Address required')
    const obj = {
      id: form.editId || uid(),
      organization_id: orgIdByName(orgs, form.org),
      org_display: form.orgName.trim(),
      address: form.address.trim(), certificate_type: form.type,
      standard: form.standard.trim(), scope: form.scope.trim(),
      iaf_code: form.iaf.trim() || '—',
      certificate_no: form.certNo.trim() || ('DRAFT-' + Date.now().toString().slice(-6)),
      initial_date: form.initial, issue_date: form.issue, expiry_date: form.expiry,
      surve1_due: form.surve1, surve2_due: form.surve2,
      show_signature: form.showSig || 'YES',
      address_size: form.addrSize || '16', address_bold: form.addrBold || 'NO',
      scope_size: form.scopeSize || '15', scope_bold: form.scopeBold || 'NO',
      verify_line: form.verifyLine.trim(),
      qr_value: form.qrValue.trim() || buildQrPayload({
        body: form.org, certificate_no: form.certNo.trim(),
        org_display: form.orgName.trim(), standard: form.standard.trim(),
        certificate_type: form.type,
        initial_date: form.initial, issue_date: form.issue, expiry_date: form.expiry,
        surve1_due: form.surve1, surve2_due: form.surve2,
      }),
      valid_until: form.expiry ? ('3 Years / ' + fmt(form.expiry)) : '',
      status, version: form.version || 'v1',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    const c = [...certs]
    const i = c.findIndex((x) => x.id === obj.id)
    if (i >= 0) {
      if (c[i].status === 'final' && status === 'final') obj.version = bump(c[i].version)
      obj.created_at = c[i].created_at
      c[i] = obj
    } else c.push(obj)
    persist(c); setStep(4)
    setForm((f) => ({ ...f, editId: obj.id, status, certNo: obj.certificate_no, version: obj.version }))
    // Word (editable) + PDF (exact photo) auto-download, same base name
    const base = certFileBase(obj.certificate_no)
    const okWord = await downloadWordFile(obj, form.org, base)
    const okPdf = await downloadPDF(base)
    if (okPdf && okWord) {
      alert(`${status === 'draft' ? 'DRAFT saved' : 'FINAL approved'} + Word & PDF downloaded (${base}.pdf / ${base}.docx)`)
    } else {
      alert(`${status === 'draft' ? 'DRAFT saved' : 'FINAL approved'} (ek file download me issue — toolbar buttons se dobara try karo)`)
    }
  }

  const finalize = (id) => {
    persist(certs.map((x) => (x.id === id ? { ...x, status: 'final', updated_at: new Date().toISOString() } : x)))
  }
  const delCert = (id) => {
    if (!confirm('Delete?')) return
    persist(certs.filter((x) => x.id !== id))
  }
  // --- Verify: scan QR -> data pata chale ---
  const verifyByNo = () => {
    const q = verifyNo.trim().toLowerCase()
    if (!q) { setVerifyMsg('Certificate No likho'); setVerifyResult(null); return }
    const r = certs.find((x) => (x.certificate_no || '').toLowerCase() === q)
    if (r) { setVerifyResult({ ...r, fromQr: false }); setVerifyMsg('') }
    else { setVerifyResult(null); setVerifyMsg('Record nahi mila — No. check karo ya QR paste karo') }
  }
  const verifyByQr = () => {
    const p = parseQrPayload(verifyQr)
    if (p) {
      // QR me poora data hai — bina internet ke bhi dikhega.
      // Agar same cert DB me hai to full record (scope/address) merge karo.
      const match = certs.find((x) => x.certificate_no && p.certificate_no && x.certificate_no.toLowerCase() === p.certificate_no.toLowerCase())
      setVerifyResult({ ...(match || {}), ...p, fromQr: true })
      setVerifyMsg('')
    } else {
      // QR JSON nahi hai to use cert-no samjho
      const q = verifyQr.trim().toLowerCase()
      const r = certs.find((x) => (x.certificate_no || '').toLowerCase() === q)
      if (r) { setVerifyResult({ ...r, fromQr: false }); setVerifyMsg('') }
      else { setVerifyResult(null); setVerifyMsg('QR samajh nahi aaya — QR scan text paste karo ya Cert No. likho') }
    }
  }
  const autoFill = () => setForm((f) => ({
    ...f, org: 'CCPL', orgName: 'D BALAJI PIPE FITTINGS',
    address: 'CHENNAI TAMIL NADU-600001 (INDIA)\nGUJARAT AHMEDABAD-380023 (INDIA)\nMUMBAI , MAHARASHTRA (INDIA)',
    type: 'QMS', standard: 'ISO 9001:2015',
    scope: 'MANUFACTURER, EXPORTER & DEALER IN STOCKIEST & SUPPLIERS OF STAINLESS STEEL, MFG PIPES FITTINGS, BUTT WELD AND FORGE FITTINGS, DAIRY, SOCKET WELD FITTINGS, FLANGES, BRASS, STEEL, BALL VALVES, SCREWED AND FLANGED END BALL VALVE 2 WAY, 3 WAY, 4 WAY, 5 WAY, GUNMETAL VALVES BRASS, MINI VALVES (M) AND MINI VALVES (F) DEALERS, STOCKIEST: PLATES, SHEET COIL, SEAMLESS & PIPES TUBES SQUARE TUBES, FLATS, ANGLES, STEEL, BRASS, STEEL, ASTM A 106 GR C.S & M.S PIPES FITTINGS, VARIOUS TYPES OF FERROUS & NON-FERROUS METAL.',
    certNo: '20DQHO25', initial: '2020-09-10', issue: '2020-09-10', expiry: '2023-09-09',
    surve1: '2021-08-10', surve2: '2022-08-10',
    showSig: 'YES', verifyLine: 'Verify this certificate at www.ccplcertification.co.in — Scan QR to verify', qrValue: '',
  }))

  const previewCert = {
    org_display: form.orgName, address: form.address, scope: form.scope,
    standard: form.standard, certificate_no: form.certNo || 'XX-XXXX-XXX',
    initial_date: form.initial, issue_date: form.issue, expiry_date: form.expiry,
    surve1_due: form.surve1, surve2_due: form.surve2,
    address_size: form.addrSize, address_bold: form.addrBold,
    scope_size: form.scopeSize, scope_bold: form.scopeBold,
    show_signature: form.showSig, verify_line: form.verifyLine, qr_value: form.qrValue,
    valid_until: form.expiry ? ('3 Years / ' + fmt(form.expiry)) : '',
    status: form.editId ? (certs.find((x) => x.id === form.editId)?.status || 'draft') : 'draft',
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return [...certs]
      .filter((r) => (!fStatus || r.status === fStatus))
      .filter((r) => (!fOrg || orgNameById(orgs, r.organization_id) === fOrg))
      .filter((r) => (!fType || r.certificate_type === fType))
      .filter((r) => (!q || (r.certificate_no + r.standard + (r.org_display || '') + orgNameById(orgs, r.organization_id)).toLowerCase().includes(q)))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [certs, orgs, search, fStatus, fOrg, fType])

  const recent = [...certs].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6)
  const nav = (v) => setView(v)
  const printNow = () => window.print()
  // Exact PDF: screen jaisa dikhe waisa hi 1-page A4 PDF (koi change nahi)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [wordBusy, setWordBusy] = useState(false)
  // Same base name for Word + PDF, e.g. "20DQHO25" -> "20DQHO25.pdf" + "20DQHO25.docx"
  // Ek hi screenshot dono me — PDF aur Word 100% same.
  const captureCert = async () => {
    const el = document.querySelector('#certHost .cert-sheet')
    if (!el) { alert('Pehle preview load hone do'); return null }
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    return { canvas, dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
  }
  const downloadPDF = async (baseName, shot) => {
    try {
      setPdfBusy(true)
      const s = shot || await captureCert()
      if (!s) return false
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pw = 210, ph = 297
      let w = pw, h = (pw * s.height) / s.width
      if (h > ph) { h = ph; w = (ph * s.width) / s.height }
      pdf.addImage(s.dataUrl, 'PNG', (pw - w) / 2, 0, w, h)
      pdf.save(`${baseName || certFileBase(form.certNo)}.pdf`)
      return true
    } catch (e) {
      alert('PDF error: ' + e.message)
      return false
    } finally {
      setPdfBusy(false)
    }
  }
  const downloadWordFile = async (certObj, bodyLabel, baseName) => {
    try {
      setWordBusy(true)
      await downloadWord(certObj || previewCert, bodyLabel || form.org, baseName || certFileBase(form.certNo))
      return true
    } catch (e) {
      alert('Word error: ' + e.message)
      return false
    } finally {
      setWordBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      {/* Sidebar */}
      <aside className="w-[270px] shrink-0 bg-[#0f2043] text-blue-100 p-5 hidden lg:flex flex-col gap-4 sticky top-0 h-screen">
        <div>
          <div className="mx-auto w-[110px] h-[110px] rounded-full bg-[#1a237e] text-white font-extrabold text-2xl flex flex-col items-center justify-center leading-none">CCPL<span className="text-[9px] tracking-[2px]">• DELANO •</span></div>
          <div className="text-center text-[11px] tracking-[1.5px] mt-2 font-bold">QUALITY MANAGEMENT<br />SYSTEM</div>
        </div>
        <nav className="flex flex-col gap-1.5">
          {[
            ['dashboard', '◉ Dashboard'], ['create', '＋ New Certificate'],
            ['certificates', `▤ All Certificates (${certs.length})`],
            ['verify', '✓ Verify QR'],
          ].map(([v, l]) => (
            <button key={v} onClick={() => nav(v)} className={`text-left px-3 py-2.5 rounded-[10px] font-semibold ${view === v ? 'bg-[#2456a6]' : 'bg-[#16295a] hover:bg-[#2456a6]'}`}>{l}</button>
          ))}
          <button onClick={() => { setFStatus('draft'); setView('certificates') }} className="text-left px-3 py-2.5 rounded-[10px] font-semibold bg-[#16295a]">◇ Drafts ({drafts})</button>
          <button onClick={() => { setFStatus('final'); setView('certificates') }} className="text-left px-3 py-2.5 rounded-[10px] font-semibold bg-[#16295a]">⬣ Final ({finals})</button>
          <div className="text-[11px] tracking-[1.5px] opacity-60 mt-2">ORGANIZATIONS</div>
          {['CCPL', 'Delano'].map((o) => (
            <button key={o} onClick={() => { setFOrg(o); setFStatus(''); setView('certificates') }} className="text-left px-3 py-1.5 rounded-[10px] text-sm bg-[#16295a]">{o}</button>
          ))}
          <div className="text-[11px] tracking-[1.5px] opacity-60 mt-2">FLOW</div>
          <div className="text-[11px] bg-white/10 p-2 rounded-lg leading-relaxed">Login → Dashboard → Org → Type → Details → Preview → Draft → Final → PDF</div>
        </nav>
        <div className="mt-auto text-xs bg-white/10 p-2.5 rounded-[10px]">Security / Login — <b>later phase</b><br /><span className="opacity-70">DB: organizations → certificates → versions → PDF</span></div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-5 md:p-7 max-w-[1300px]">
        <header className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-extrabold capitalize">{view}</h1>
            <p className="text-slate-500 text-sm">Welcome — select organization, certificate type and generate.</p>
          </div>
          <div className="flex gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search org / cert no / standard..." className="px-3 py-2.5 rounded-[10px] border border-slate-300 min-w-[260px]" />
            <button onClick={() => startCreate()} className="px-4 py-2.5 rounded-[10px] font-bold bg-blue-700 text-white">+ New Certificate</button>
          </div>
        </header>

        {view === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {[['Total Certificates', certs.length, 'CCPL + Delano', 'border-slate-300'], ['Draft', drafts, 'Editable • no sign • XX dates', 'border-t-4 !border-amber-500'], ['Final', finals, 'Locked • signed', 'border-t-4 !border-green-600'], ['Organizations', 2, 'CCPL • Delano', 'border-t-4 !border-blue-700']].map(([l, v, s, c]) => (
                <div key={l} className={`bg-white rounded-2xl p-3.5 shadow border ${c}`}><div className="text-xs text-slate-500 font-bold uppercase">{l}</div><div className="text-3xl font-extrabold">{v}</div><div className="text-xs text-slate-500">{s}</div></div>
              ))}
            </div>

            <h2 className="mt-5 mb-2 font-bold">1 — Select Organization</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {['CCPL', 'Delano'].map((o) => (
                <div key={o} className="bg-white rounded-2xl p-4 shadow">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold text-white ${o === 'CCPL' ? 'bg-[#0f2043]' : 'bg-blue-700'}`}>{o}</span>
                  <h3 className="font-extrabold text-lg mt-1">{o}</h3>
                  <p className="text-slate-500 text-sm">{orgs.find((x) => x.org_name === o)?.address}</p>
                  <div className="flex justify-between items-center mt-2">
                    <button onClick={() => startCreate(o)} className="px-3 py-1.5 rounded-[10px] text-sm font-bold bg-blue-700 text-white">Select {o} →</button>
                    <span className="text-xs text-slate-500">{o === 'CCPL' ? ccplCount : delCount} certs</span>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="mt-5 mb-2 font-bold">2 — Select Certificate Type</h2>
            <div className="grid md:grid-cols-3 gap-3">
              {[['QMS', 'ISO 9001:2015', 'Quality Management'], ['FSMS', 'ISO 22000:2018', 'Food Safety'], ['EMS', 'ISO 14001:2015', 'Environmental']].map(([t, s, d]) => (
                <button key={t} onClick={() => startCreate(null, t)} className="bg-white border-2 border-blue-100 hover:border-blue-700 rounded-2xl p-3.5 text-left flex flex-col"><b className="text-xl">{t}</b><span className="font-bold text-blue-700">{s}</span><small className="text-slate-500">{d}</small></button>
              ))}
            </div>

            <h2 className="mt-5 mb-2 font-bold">Recent Certificates <button onClick={() => setView('certificates')} className="text-blue-700 font-bold">View all →</button></h2>
            <div className="bg-white rounded-2xl shadow overflow-auto">
              <table className="w-full text-sm"><thead><tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:bg-blue-50 [&>th]:text-xs [&>th]:uppercase">{['Cert No', 'Organization', 'Type / Standard', 'Issue', 'Status', 'Action'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{recent.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 [&>td]:px-3 [&>td]:py-2.5">
                    <td><b>{r.certificate_no}</b></td>
                    <td>{orgNameById(orgs, r.organization_id)}<br /><small className="text-slate-500">{r.org_display}</small></td>
                    <td>{r.certificate_type} / {r.standard}</td><td>{fmt(r.issue_date)}</td>
                    <td><span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${r.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{r.status.toUpperCase()}</span></td>
                    <td><button onClick={() => editCert(r.id)} className="px-2.5 py-1.5 rounded-lg bg-slate-200 font-bold text-xs">Open</button></td>
                  </tr>))}</tbody></table>
            </div>
          </>
        )}

        {view === 'create' && (
          <>
            <div className="flex items-center gap-2 my-2">
              {[1, 2, 3, 4].map((n) => (<div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
                <span className={`px-3.5 py-1.5 rounded-full font-extrabold text-[13px] border-2 ${step >= n ? 'border-blue-700 text-blue-700 bg-white' : 'border-slate-300 bg-white'}`}>{n} {['Org', 'Type', 'Details', 'Preview'][n - 1]}</span>
                {n < 4 && <div className="flex-1 h-0.5 bg-slate-300" />}</div>))}
            </div>
            <div className="grid xl:grid-cols-[430px_1fr] gap-3.5 items-start">
              <div className="bg-white rounded-2xl p-4 shadow flex flex-col gap-1.5">
                <h3 className="font-bold">Enter / Edit Certificate Details</h3>
                {[
                  ['org', 'Organization *'], ['orgName', 'Organization Full Name (printed)'],
                ].map(() => null)}
                <label className="text-xs font-bold text-slate-600 mt-1">Organization *</label>
                <div className="flex gap-4">
                  {['CCPL', 'Delano'].map((o) => (<label key={o} className="flex gap-1.5 items-center text-sm"><input type="radio" checked={form.org === o} onChange={() => set('org', o)} />{o}</label>))}
                </div>
                <label className="text-xs font-bold text-slate-600 mt-1">Organization Full Name (printed)</label>
                <input value={form.orgName} onChange={(e) => set('orgName', e.target.value)} placeholder="e.g. D BALAJI PIPE FITTINGS" className="px-2.5 py-2 border border-slate-300 rounded-lg text-sm" />
                <label className="text-xs font-bold text-slate-600 mt-1">Address * (one branch per line) — UPPERCASE print</label>
                <textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={3} className="px-2.5 py-2 border border-slate-300 rounded-lg text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-slate-600">Address Size (org 19px se chhota)</label>
                    <select value={form.addrSize} onChange={(e) => set('addrSize', e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm">{['10', '11', '12', '13', '14', '15', '16', '17', '18', '20'].map((s) => <option key={s} value={s}>{s}px</option>)}</select></div>
                  <div><label className="text-xs font-bold text-slate-600">Address Bold</label>
                    <select value={form.addrBold} onChange={(e) => set('addrBold', e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm"><option>NO</option><option>YES</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-slate-600">Certificate Type *</label>
                    <select value={form.type} onChange={(e) => set('type', e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm">{['QMS', 'FSMS', 'EMS'].map((t) => <option key={t}>{t}</option>)}</select></div>
                  <div><label className="text-xs font-bold text-slate-600">Standard *</label>
                    <input value={form.standard} onChange={(e) => set('standard', e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm" /></div>
                </div>
                <label className="text-xs font-bold text-slate-600 mt-1">Scope (printed as paragraph) — UPPERCASE print</label>
                <textarea value={form.scope} onChange={(e) => set('scope', e.target.value)} rows={5} className="px-2.5 py-2 border border-slate-300 rounded-lg text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-bold text-slate-600">Scope Size (org 19px se chhota)</label>
                    <select value={form.scopeSize} onChange={(e) => set('scopeSize', e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm">{['10', '11', '12', '13', '14', '15', '16', '17', '18', '20'].map((s) => <option key={s} value={s}>{s}px</option>)}</select></div>
                  <div><label className="text-xs font-bold text-slate-600">Scope Bold</label>
                    <select value={form.scopeBold} onChange={(e) => set('scopeBold', e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm"><option>NO</option><option>YES</option></select></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[['iaf', 'IAF Code', 'e.g. 17 / 03'], ['certNo', 'Certificate No *', '20DQHO25'], ['version', 'Version', 'v1']].map(([k, l, p]) => (
                    <div key={k}><label className="text-xs font-bold text-slate-600">{l}</label><input value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={p} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm" /></div>))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[['initial', 'Initial Registration Date'], ['issue', 'Issuance Date'], ['expiry', 'Date of Expiry*'], ['surve1', '1st Surve. Due'], ['surve2', '2nd Surve. Due']].map(([k, l]) => (
                    <div key={k}><label className="text-xs font-bold text-slate-600">{l}</label><input type="date" value={form[k]} onChange={(e) => set(k, e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm" /></div>))}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1">
                  <label className="text-xs font-bold text-slate-600">Signature on certificate? *</label>
                  <div className="flex gap-4 mt-1">
                    {['YES', 'NO'].map((o) => (
                      <label key={o} className="flex gap-1.5 items-center text-sm font-semibold">
                        <input type="radio" checked={form.showSig === o} onChange={() => set('showSig', o)} />{o}
                      </label>
                    ))}
                  </div>
                  <label className="text-xs font-bold text-slate-600 mt-2 block">Certificate verify line (printed above signature)</label>
                  <input value={form.verifyLine} onChange={(e) => set('verifyLine', e.target.value)} placeholder="Verify this certificate at www.ccplcertification.co.in — Scan QR to verify" className="mt-1 w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm" />
                  <label className="text-xs font-bold text-slate-600 mt-2 block">QR content (blank = auto: poora data QR me save hoga)</label>
                  <input value={form.qrValue} onChange={(e) => set('qrValue', e.target.value)} placeholder="Blank rakho = auto data QR" className="mt-1 w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button onClick={autoFill} className="px-3.5 py-2.5 rounded-[10px] font-bold bg-slate-200 text-sm">↺ Sample (BALAJI)</button>
                  <button onClick={() => saveCert('draft')} className="px-3.5 py-2.5 rounded-[10px] font-bold bg-amber-500 text-sm">Save Draft</button>
                  <button onClick={() => saveCert('final')} className="px-3.5 py-2.5 rounded-[10px] font-bold bg-green-600 text-white text-sm">Approve → Final</button>
                </div>
                <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg"><b>Draft:</b> editable, watermark, no sign, XX/XX/XXXX dates. <b>Final:</b> locked, signed.</p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${previewCert.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{previewCert.status.toUpperCase()} PREVIEW</span>
                  <div className="flex gap-2">
                    <button onClick={() => downloadPDF()} disabled={pdfBusy} className="px-2.5 py-1.5 rounded-lg bg-green-700 text-white font-bold text-xs disabled:opacity-60">{pdfBusy ? 'PDF...' : '⬇ PDF'}</button>
                    <button onClick={() => downloadWordFile(previewCert, form.org)} disabled={wordBusy} className="px-2.5 py-1.5 rounded-lg bg-indigo-700 text-white font-bold text-xs disabled:opacity-60">{wordBusy ? 'Word...' : '⬇ Word'}</button>
                    <button onClick={printNow} className="px-2.5 py-1.5 rounded-lg bg-blue-700 text-white font-bold text-xs">⎙ Print</button>
                  </div>
                </div>
                <div id="certHost">
                  <CertificatePreview cert={previewCert} orgLabel={form.org} />
                </div>
              </div>
            </div>
          </>
        )}

        {view === 'verify' && (
          <div className="grid lg:grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow">
              <h2 className="font-bold">1 — Certificate No. se verify</h2>
              <div className="flex gap-2 mt-2">
                <input value={verifyNo} onChange={(e) => setVerifyNo(e.target.value)} placeholder="e.g. 20DQHO25" className="flex-1 px-2.5 py-2 border border-slate-300 rounded-lg text-sm" />
                <button onClick={verifyByNo} className="px-3.5 py-2 rounded-[10px] font-bold bg-blue-700 text-white text-sm">Check</button>
              </div>
              <h2 className="font-bold mt-4">2 — QR scan text paste karo</h2>
              <p className="text-xs text-slate-500">Phone se QR scan karo → jo text mile wo yahan paste karo → Verify dabao. QR me poora data saved hai.</p>
              <textarea value={verifyQr} onChange={(e) => setVerifyQr(e.target.value)} rows={4} placeholder='{"v":1,"b":"CCPL","n":"20DQHO25",...}' className="mt-2 w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-mono" />
              <button onClick={verifyByQr} className="mt-2 px-3.5 py-2 rounded-[10px] font-bold bg-green-600 text-white text-sm">Verify QR</button>
              {verifyMsg && <p className="text-xs text-red-600 mt-2">{verifyMsg}</p>}
            </div>
            <div className="bg-white rounded-2xl p-4 shadow">
              <h2 className="font-bold">Result — QR scan par ye data dikhega</h2>
              {!verifyResult ? (
                <p className="text-sm text-slate-500 mt-2">Abhi kuch verify nahi hua. Left me Cert No. ya QR text daalo.</p>
              ) : (
                <div className="mt-2 text-sm flex flex-col gap-1.5">
                  <div className="flex gap-2 items-center">
                    <span className="font-bold">Cert No:</span><b>{verifyResult.certificate_no}</b>
                    {verifyResult.status && <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${verifyResult.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{verifyResult.status.toUpperCase()}</span>}
                    {verifyResult.fromQr && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">FROM QR</span>}
                  </div>
                  <div><span className="font-bold">Body:</span> {verifyResult.body || orgNameById(orgs, verifyResult.organization_id) || '—'} ({verifyResult.certificate_type || 'QMS'})</div>
                  <div><span className="font-bold">Client:</span> {verifyResult.org_display || '—'}</div>
                  <div><span className="font-bold">Standard:</span> {verifyResult.standard || '—'}</div>
                  <div><span className="font-bold">Initial:</span> {fmt(verifyResult.initial_date)} | <span className="font-bold">Issued:</span> {fmt(verifyResult.issue_date)} | <span className="font-bold">Expiry:</span> {fmt(verifyResult.expiry_date)}</div>
                  <div><span className="font-bold">1st Surve:</span> {fmt(verifyResult.surve1_due || verifyResult.surve1)} | <span className="font-bold">2nd Surve:</span> {fmt(verifyResult.surve2_due || verifyResult.surve2)}</div>
                  {verifyResult.scope && <div><span className="font-bold">Scope:</span> <span className="text-xs">{String(verifyResult.scope).slice(0, 600)}</span></div>}
                  {verifyResult.address && <div><span className="font-bold">Address:</span> <span className="text-xs">{String(verifyResult.address).slice(0, 300)}</span></div>}
                  <div className="text-xs mt-1 px-2 py-1.5 rounded-lg bg-slate-50 text-slate-600">
                    {verifyResult.expiry_date && new Date(verifyResult.expiry_date) < new Date()
                      ? '⚠ Expiry date nikal gayi — EXPIRED'
                      : '✓ Dates valid (expiry check ke hisab se)'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'certificates' && (
          <>
            <div className="flex gap-2 mb-3 flex-wrap">
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="px-2.5 py-2 border rounded-lg text-sm"><option value="">All status</option><option value="draft">Draft</option><option value="final">Final</option></select>
              <select value={fOrg} onChange={(e) => setFOrg(e.target.value)} className="px-2.5 py-2 border rounded-lg text-sm"><option value="">CCPL + Delano</option><option>CCPL</option><option>Delano</option></select>
              <select value={fType} onChange={(e) => setFType(e.target.value)} className="px-2.5 py-2 border rounded-lg text-sm"><option value="">QMS + FSMS + EMS</option><option>QMS</option><option>FSMS</option><option>EMS</option></select>
            </div>
            <div className="bg-white rounded-2xl shadow overflow-auto">
              <table className="w-full text-sm"><thead><tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:bg-blue-50 [&>th]:text-xs [&>th]:uppercase">{['Cert No', 'Organization', 'Type', 'Standard', 'Issue → Expiry', 'Ver', 'Status', 'Actions'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{filtered.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 [&>td]:px-3 [&>td]:py-2.5">
                    <td><b>{r.certificate_no}</b></td>
                    <td>{orgNameById(orgs, r.organization_id)}<br /><small className="text-slate-500">{r.org_display}</small></td>
                    <td>{r.certificate_type}</td><td>{r.standard}</td>
                    <td>{r.status === 'draft' ? 'XX/XX/XXXX → XX/XX/XXXX' : `${fmt(r.issue_date)} → ${fmt(r.expiry_date)}`}</td>
                    <td>{r.version}</td>
                    <td><span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${r.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{r.status.toUpperCase()}</span></td>
                    <td className="whitespace-nowrap flex gap-1">
                      <button onClick={() => editCert(r.id)} className="px-2 py-1 rounded-lg bg-slate-200 font-bold text-xs">Edit</button>
                      {r.status === 'draft' && <button onClick={() => finalize(r.id)} className="px-2 py-1 rounded-lg bg-green-600 text-white font-bold text-xs">Final</button>}
                      <button onClick={() => delCert(r.id)} className="px-2 py-1 rounded-lg bg-slate-200 font-bold text-xs">✕</button>
                    </td>
                  </tr>))}
                </tbody></table>
            </div>
          </>
        )}
      </main>

      {/* print-only */}
      <div id="printRoot"><CertificatePreview cert={previewCert} orgLabel={form.org} /></div>
    </div>
  )
}
