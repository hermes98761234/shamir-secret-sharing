import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CopyButton } from './kit'
import type { T } from './i18n'

export default function ShareCard({ text, title, t }: { text: string; title: string; t: T }) {
  const [svg, setSvg] = useState('')
  const [tooLong, setTooLong] = useState(false)
  useEffect(() => {
    let live = true
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((s) => { if (live) { setSvg(s); setTooLong(false) } })
      .catch(() => { if (live) { setSvg(''); setTooLong(true) } })
    return () => { live = false }
  }, [text])
  return (
    <div className="box share">
      <h3>{title}</h3>
      {svg ? <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} /> : tooLong ? <p className="err-text">{t('Share is too long for a QR code')}</p> : null}
      <pre className="mono">{text}</pre>
      <div className="row noprint"><CopyButton text={text} t={t} /></div>
    </div>
  )
}
