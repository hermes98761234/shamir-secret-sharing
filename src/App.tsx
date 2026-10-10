import { useMemo, useState } from 'react'
import { Shell, Tabs, download, usePersisted, usePrefs, CopyButton } from './kit'
import { UK } from './uk'
import ShareCard from './ShareCard'
import { combine, encodeShare, parseShares, split } from './lib/shamir'

type Tab = 'split' | 'combine'
const REPO = 'shamir-secret-sharing'

export default function App() {
  const { prefs, setPrefs, t } = usePrefs(UK)
  const [tab, setTab] = useState<Tab>('split')
  const [cfg, setCfg] = usePersisted('shamir-cfg', { n: 5, k: 3 })
  const [secret, setSecret] = useState('correct horse battery staple')
  const [shares, setShares] = useState<string[]>(() => split(new TextEncoder().encode('correct horse battery staple'), 5, 3).map(encodeShare))
  const [err, setErr] = useState('')
  const [pasted, setPasted] = useState('')

  function gen() {
    setErr('')
    try {
      const out = split(new TextEncoder().encode(secret), cfg.n, cfg.k)
      setShares(out.map(encodeShare))
    } catch (e) {
      setShares([]); setErr(t((e as Error).message))
    }
  }

  const rec = useMemo(() => {
    const p = parseShares(pasted)
    let secretText = ''
    let hex = false
    let error = ''
    const need = p.shares[0]?.k ?? 0
    const have = new Set(p.shares.map((s) => s.x)).size
    if (p.shares.length) {
      try {
        const bytes = combine(p.shares)
        try { secretText = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { hex = true; secretText = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('') }
        return { p, secretText, hex, error, need, have, len: bytes.length }
      } catch (e) { error = (e as Error).message }
    }
    return { p, secretText, hex, error, need, have, len: 0 }
  }, [pasted])

  const num = (v: string, d: number) => Math.max(1, Math.min(255, Math.floor(+v) || d))

  return (
    <Shell title={t('Shamir Secret Sharing')} tagline={t('Split a secret into shares. Any K of N shares recover it; fewer reveal nothing.')} repo={REPO} note={t('Everything runs in your browser. Treat printed shares like the secret itself.')} t={t} prefs={prefs} setPrefs={setPrefs}>
      <div className="noprint"><Tabs<Tab> value={tab} onChange={setTab} items={[['split', t('Split')], ['combine', t('Combine')]]} /></div>
      {tab === 'split' ? (
        <>
          <div className="box noprint">
            <div className="field"><label>{t('Secret to split')}</label>
              <textarea className="mono" rows={3} value={secret} onChange={(e) => setSecret(e.target.value)} /></div>
            <div className="grid2" style={{ maxWidth: 420 }}>
              <div className="field"><label>{t('Total shares (N)')}</label><input type="number" min={1} max={255} value={cfg.n} onChange={(e) => setCfg({ ...cfg, n: num(e.target.value, 5) })} /></div>
              <div className="field"><label>{t('Threshold (K)')}</label><input type="number" min={1} max={255} value={cfg.k} onChange={(e) => setCfg({ ...cfg, k: num(e.target.value, 3) })} /></div>
            </div>
            <div className="row"><button className="primary" onClick={gen}>{t('Generate shares')}</button></div>
            {err && <p className="err-text">{err}</p>}
          </div>
          {shares.length > 0 && (
            <>
              <div className="row noprint">
                <strong>{t('Shares')}</strong>
                <span className="hint" style={{ margin: 0 }}>{t('Any {0} of these {1} shares recover the secret.', cfg.k, shares.length)}</span>
                <span className="spacer" />
                <button onClick={() => download('shares.txt', shares.join('\n') + '\n', 'text/plain')}>{t('Download all')}</button>
                <button onClick={() => window.print()}>{t('Print shares')}</button>
              </div>
              <p className="hint noprint">{t('Share the shares through different channels. Keep the threshold in mind: losing N-K+1 shares loses the secret.')}</p>
              <div className="share-grid">
                {shares.map((s, i) => <ShareCard key={s} text={s} title={t('Share {0} of {1}', i + 1, shares.length)} t={t} />)}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="cols">
          <div className="box">
            <div className="field"><label>{t('Paste shares, one per line')}</label>
              <textarea className="mono" rows={10} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="SSS1-3-1-…" /></div>
            <button className="small" onClick={() => setPasted(shares.slice(0, cfg.k).join('\n'))} disabled={!shares.length}>{t('Use shares from Split')}</button>
          </div>
          <div className="box">
            <h2>{t('Recovered secret')}</h2>
            {rec.p.shares.length > 0 && <p className="hint">{t('Valid shares: {0}', rec.p.shares.length)}{rec.need ? ' · ' + t('Have {0} of {1} shares needed.', rec.have, rec.need) : ''}</p>}
            {rec.p.errors.length > 0 && <p className="warn-text">{t('Ignored: {0}', rec.p.errors.map((e) => e.error).join('; '))}</p>}
            {rec.error && <p className="err-text">{t('Error: {0}', rec.error)}</p>}
            {rec.len > 0 && (
              <>
                <p className="ok-text">{t('Recovered {0} bytes.', rec.len)}</p>
                {rec.hex && <p className="hint">{t('Not valid text, shown as hex:')}</p>}
                <pre>{rec.secretText}</pre>
                <CopyButton text={rec.secretText} t={t} />
              </>
            )}
          </div>
        </div>
      )}
    </Shell>
  )
}
