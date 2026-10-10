# Shamir Secret Sharing

Shamir secret sharing over GF(256): split a secret into N shares with threshold K, combine them back, QR codes and printable share sheets. Client-side.

**Try it: [hermes98761234.github.io/shamir-secret-sharing](https://hermes98761234.github.io/shamir-secret-sharing/)**

[![Deploy to GitHub Pages](https://github.com/hermes98761234/shamir-secret-sharing/actions/workflows/deploy.yml/badge.svg)](https://github.com/hermes98761234/shamir-secret-sharing/actions/workflows/deploy.yml)

![Screenshot of Shamir Secret Sharing](docs/screenshot.png)

## Features

- **Split any secret** (text) into N shares with threshold K (1 ≤ K ≤ N ≤ 255); any K shares recover it, fewer reveal nothing.
- **Combine** by pasting shares: validates checksums, flags damaged or mismatched shares and shows progress toward the threshold.
- **QR code per share** and a **print layout** for paper backups; download all shares as a text file.
- Compact self-describing share format with CRC-16: `SSS1-K-X-data`.
- English and Ukrainian, light/dark/system theme. No backend, no tracking: your data never leaves the browser.

## How it works

Each byte of the secret is the constant term of a random polynomial of degree K-1 over GF(256) (the AES field, x^8+x^4+x^3+x+1). Share X is the polynomial evaluated at x = X. Recovery uses Lagrange interpolation at 0. Coefficients come from the browser CSPRNG (crypto.getRandomValues). The field arithmetic is tested against FIPS-197 reference values. QR codes are drawn with the qrcode library.

## Quick start

You need [Node.js](https://nodejs.org/) 22.

```bash
git clone https://github.com/hermes98761234/shamir-secret-sharing.git
cd shamir-secret-sharing
npm install
npm run dev       # http://localhost:5173
npm test          # unit tests
npm run build     # static site in dist/
```

## License

MIT
