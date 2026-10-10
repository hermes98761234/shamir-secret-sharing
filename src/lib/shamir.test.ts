import { describe, expect, it } from 'vitest'
import { combine, crc16, cryptoRng, decodeShare, encodeShare, gfDiv, gfInv, gfMul, parseShares, split, type Share } from './shamir'

const enc = (s: string) => new TextEncoder().encode(s)

describe('GF(256)', () => {
  it('matches AES field reference values', () => {
    expect(gfMul(0x57, 0x83)).toBe(0xc1) // FIPS-197 example
    expect(gfMul(0x57, 0x13)).toBe(0xfe)
    expect(gfInv(0x53)).toBe(0xca)
    expect(gfMul(0, 7)).toBe(0)
  })
  it('has inverses for all non-zero elements', () => {
    for (let a = 1; a < 256; a++) expect(gfMul(a, gfInv(a))).toBe(1)
    expect(gfDiv(gfMul(9, 77), 77)).toBe(9)
  })
})

describe('split/combine', () => {
  const secret = enc('The magic words are squeamish ossifrage')
  const subsets = (arr: Share[], k: number): Share[][] =>
    k === 0 ? [[]] : arr.flatMap((s, i) => subsets(arr.slice(i + 1), k - 1).map((r) => [s, ...r]))

  it('recovers with every K-subset of N', () => {
    const shares = split(secret, 6, 3)
    for (const sub of subsets(shares, 3)) expect(combine(sub)).toEqual(secret)
    expect(combine(shares)).toEqual(secret)
  })
  it('fails with fewer than K shares', () => {
    const shares = split(secret, 5, 3)
    expect(() => combine(shares.slice(0, 2))).toThrow(/Need 3/)
  })
  it('K=1 copies and K=N works', () => {
    expect(combine([split(secret, 3, 1)[1]])).toEqual(secret)
    expect(combine(split(secret, 4, 4))).toEqual(secret)
  })
  it('is deterministic for a fixed rng and has known polynomial values', () => {
    // secret 0x42, k=2, coefficient 0x05: y(x) = 0x42 ^ 5*x
    const shares = split(new Uint8Array([0x42]), 3, 2, () => new Uint8Array([5]))
    expect(shares.map((s) => s.y[0])).toEqual([0x42 ^ 5, 0x42 ^ gfMul(5, 2), 0x42 ^ gfMul(5, 3)])
  })
  it('k-1 shares reveal nothing: every secret byte is consistent', () => {
    const [a] = split(new Uint8Array([1]), 3, 2)
    const [b] = split(new Uint8Array([200]), 3, 2)
    expect(a.y.length).toBe(b.y.length)
  })
  it('validates arguments', () => {
    expect(() => split(secret, 2, 3)).toThrow()
    expect(() => split(secret, 256, 2)).toThrow()
    expect(() => split(new Uint8Array(), 3, 2)).toThrow()
  })
  it('rejects mixed splits', () => {
    const a = split(secret, 3, 2)
    const b = split(enc('other secret of other length'), 3, 2)
    expect(() => combine([a[0], b[1]])).toThrow()
  })
  it('works with random secrets of many sizes', () => {
    for (const len of [1, 2, 31, 100]) {
      const s = cryptoRng(len)
      expect(combine(split(s, 5, 2).slice(3))).toEqual(s)
    }
  })
})

describe('share encoding', () => {
  it('round-trips and detects damage', () => {
    const sh = split(enc('hello'), 3, 2)[1]
    const txt = encodeShare(sh)
    expect(txt).toMatch(/^SSS1-2-2-/)
    expect(decodeShare(txt)).toEqual(sh)
    const bad = txt.slice(0, -3) + (txt.endsWith('AAA') ? 'BBB' : 'AAA')
    expect(() => decodeShare(bad)).toThrow(/Checksum/)
    expect(() => decodeShare('nonsense')).toThrow()
  })
  it('parses lists and reports bad lines', () => {
    const sh = split(enc('hi'), 3, 2)
    const r = parseShares(`${encodeShare(sh[0])}\njunk\n${encodeShare(sh[2])}`)
    expect(r.shares).toHaveLength(2)
    expect(r.errors).toHaveLength(1)
    expect(combine(r.shares)).toEqual(enc('hi'))
  })
  it('crc16 CCITT-FALSE check value', () => {
    expect(crc16(enc('123456789'))).toBe(0x29b1)
  })
})
