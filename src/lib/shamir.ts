/** Shamir secret sharing over GF(256) (AES field, polynomial x^8+x^4+x^3+x+1, generator 3). */

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    // multiply by generator 3 = x + 1
    let x2 = x << 1
    if (x2 & 0x100) x2 ^= 0x11b
    x = x2 ^ x
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
}

export const gfMul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])
export const gfInv = (a: number): number => {
  if (a === 0) throw new Error('inverse of zero')
  return EXP[255 - LOG[a]]
}
export const gfDiv = (a: number, b: number): number => gfMul(a, gfInv(b))

export type Rng = (n: number) => Uint8Array
export const cryptoRng: Rng = (n) => crypto.getRandomValues(new Uint8Array(n))

export interface Share { k: number; x: number; y: Uint8Array }

/** Splits `secret` into n shares, any k of which recover it. 1 <= k <= n <= 255. */
export function split(secret: Uint8Array, n: number, k: number, rng: Rng = cryptoRng): Share[] {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 1 || n < k || n > 255) throw new Error('Need 1 ≤ K ≤ N ≤ 255')
  if (secret.length === 0) throw new Error('Secret is empty')
  const shares: Share[] = Array.from({ length: n }, (_, i) => ({ k, x: i + 1, y: new Uint8Array(secret.length) }))
  const coef = rng(secret.length * (k - 1))
  for (let b = 0; b < secret.length; b++) {
    for (const s of shares) {
      // Horner: p(x) = secret + c1 x + ... + c_{k-1} x^{k-1}
      let acc = 0
      for (let j = k - 1; j >= 1; j--) acc = gfMul(acc, s.x) ^ coef[b * (k - 1) + (j - 1)]
      s.y[b] = gfMul(acc, s.x) ^ secret[b]
    }
  }
  return shares
}

/** Lagrange interpolation at x = 0. Uses the first k distinct shares. */
export function combine(shares: Share[]): Uint8Array {
  if (shares.length === 0) throw new Error('No shares')
  const k = shares[0].k
  const len = shares[0].y.length
  const uniq = new Map<number, Share>()
  for (const s of shares) {
    if (s.k !== k || s.y.length !== len) throw new Error('Shares come from different splits')
    const prev = uniq.get(s.x)
    if (prev && prev.y.some((v, i) => v !== s.y[i])) throw new Error('Two different shares have the same number')
    uniq.set(s.x, s)
  }
  if (uniq.size < k) throw new Error(`Need ${k} shares, have ${uniq.size}`)
  const pts = [...uniq.values()].slice(0, k)
  const out = new Uint8Array(len)
  for (let i = 0; i < pts.length; i++) {
    let num = 1
    let den = 1
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue
      num = gfMul(num, pts[j].x)
      den = gfMul(den, pts[i].x ^ pts[j].x)
    }
    const l = gfDiv(num, den)
    for (let b = 0; b < len; b++) out[b] ^= gfMul(pts[i].y[b], l)
  }
  return out
}

export function crc16(data: Uint8Array): number {
  let crc = 0xffff
  for (const b of data) {
    crc ^= b << 8
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const unb64 = (s: string) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))

/** Text form: SSS1-<k>-<x>-<base64url(y || crc16)>. */
export function encodeShare(s: Share): string {
  const body = new Uint8Array(s.y.length + 2)
  body.set(s.y)
  const head = new Uint8Array([s.k, s.x, ...s.y])
  const c = crc16(head)
  body[s.y.length] = c >> 8
  body[s.y.length + 1] = c & 255
  return `SSS1-${s.k}-${s.x}-${b64(body)}`
}

export function decodeShare(text: string): Share {
  const m = /^SSS1-(\d+)-(\d+)-([A-Za-z0-9_-]+)$/.exec(text.trim())
  if (!m) throw new Error('Not a share')
  const k = +m[1]
  const x = +m[2]
  if (k < 1 || k > 255 || x < 1 || x > 255) throw new Error('Bad share header')
  let body: Uint8Array
  try { body = unb64(m[3]) } catch { throw new Error('Bad share encoding') }
  if (body.length < 3) throw new Error('Share too short')
  const y = body.subarray(0, body.length - 2)
  const crc = (body[body.length - 2] << 8) | body[body.length - 1]
  if (crc16(new Uint8Array([k, x, ...y])) !== crc) throw new Error('Checksum mismatch (share damaged)')
  return { k, x, y: new Uint8Array(y) }
}

export function parseShares(text: string): { shares: Share[]; errors: { line: string; error: string }[] } {
  const shares: Share[] = []
  const errors: { line: string; error: string }[] = []
  for (const tok of text.split(/\s+/).filter(Boolean)) {
    try { shares.push(decodeShare(tok)) } catch (e) { errors.push({ line: tok, error: (e as Error).message }) }
  }
  return { shares, errors }
}
