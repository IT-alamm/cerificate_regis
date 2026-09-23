export const LS_ORG = 'ifc_organizations'
export const LS_CERT = 'ifc_certificates'
export const STD_MAP = { QMS: 'ISO 9001:2015', FSMS: 'ISO 22000:2018', EMS: 'ISO 14001:2015' }

export const uid = () => 'C' + Date.now().toString(36) + Math.floor(Math.random() * 99)
export const fmt = (d) => {
  if (!d) return '—'
  const x = new Date(d)
  // ROHS sample format: 10/09/2020
  return isNaN(x) ? d : x.toLocaleDateString('en-GB')
}
export const bump = (v) => {
  const m = /v(\d+)/.exec(v || '')
  return 'v' + ((m ? +m[1] : 1) + 1)
}

export function seed() {
  if (!localStorage.getItem(LS_ORG)) {
    localStorage.setItem(LS_ORG, JSON.stringify([
      { id: 'org-ccpl', org_name: 'CCPL', address: 'CCPL — Plot / Street / City — (edit address in form)' },
      { id: 'org-delano', org_name: 'Delano', address: 'Delano — Plot / Street / City — (edit address in form)' },
    ]))
  }
  if (!localStorage.getItem(LS_CERT)) {
    localStorage.setItem(LS_CERT, JSON.stringify([{
      id: uid(), organization_id: 'org-ccpl', org_display: 'D BALAJI PIPE FITTINGS',
      certificate_type: 'QMS', standard: 'ISO 9001:2015',
      scope: 'MANUFACTURER, EXPORTER & DEALER IN STOCKIEST & SUPPLIERS OF STAINLESS STEEL, MFG PIPES FITTINGS, BUTT WELD AND FORGE FITTINGS, DAIRY, SOCKET WELD FITTINGS, FLANGES, BRASS, STEEL, BALL VALVES, SCREWED AND FLANGED END BALL VALVE 2 WAY, 3 WAY, 4 WAY, 5 WAY, GUNMETAL VALVES BRASS, MINI VALVES (M) AND MINI VALVES (F) DEALERS, STOCKIEST: PLATES, SHEET COIL, SEAMLESS & PIPES TUBES SQUARE TUBES, FLATS, ANGLES, STEEL, BRASS, STEEL, ASTM A 106 GR C.S & M.S PIPES FITTINGS, VARIOUS TYPES OF FERROUS & NON-FERROUS METAL.',
      address: 'CHENNAI TAMIL NADU-600001 (INDIA)\nGUJARAT AHMEDABAD-380023 (INDIA)\nMUMBAI , MAHARASHTRA (INDIA)',
      iaf_code: '—', certificate_no: '20DQHO25',
      initial_date: '2020-09-10', issue_date: '2020-09-10',
      expiry_date: '2023-09-09', surve1_due: '2021-08-10', surve2_due: '2022-08-10',
      valid_until: '',
      status: 'final', version: 'v1',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }]))
  }
}

/* QR payload: compact JSON encoded in QR, so scan reveals data without internet.
   Keys: v=ver, b=body(CCPL/Delano), n=cert no, o=client org, s=standard, t=type,
   init/iss/exp/s1/s2=dates */
export const buildQrPayload = (c = {}) => {
  const o = {
    v: 1,
    b: String(c.body || c.org || 'CCPL').toUpperCase(),
    n: c.certificate_no || c.certNo || '',
    o: String(c.org_display || c.orgName || '').slice(0, 120),
    s: c.standard || '',
    t: c.certificate_type || c.type || 'QMS',
    init: c.initial_date || c.initial || '',
    iss: c.issue_date || c.issue || '',
    exp: c.expiry_date || c.expiry || '',
    s1: c.surve1_due || c.surve1 || '',
    s2: c.surve2_due || c.surve2 || '',
  }
  return JSON.stringify(o)
}
// Parse pasted/scanned QR text back into readable data. Returns null if invalid.
export const parseQrPayload = (text = '') => {
  const t = String(text).trim()
  if (!t) return null
  try {
    const o = JSON.parse(t)
    if (o && (o.n || o.o)) {
      return {
        body: o.b || '', certificate_no: o.n || '',
        org_display: o.o || '', standard: o.s || '', certificate_type: o.t || '',
        initial_date: o.init || '', issue_date: o.iss || '',
        expiry_date: o.exp || '', surve1_due: o.s1 || '', surve2_due: o.s2 || '',
        fromQr: true,
      }
    }
  } catch { /* not JSON — fall through */ }
  return null
}

export const getOrgs = () => JSON.parse(localStorage.getItem(LS_ORG) || '[]')
export const getCerts = () => JSON.parse(localStorage.getItem(LS_CERT) || '[]')
export const setCerts = (c) => localStorage.setItem(LS_CERT, JSON.stringify(c))
export const orgNameById = (orgs, id) => (orgs.find((o) => o.id === id) || {}).org_name || id
export const orgIdByName = (orgs, name) => (orgs.find((o) => o.org_name === name) || {}).id || 'org-ccpl'
