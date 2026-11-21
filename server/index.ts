import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getRequestListener } from '@hono/node-server'
import { api } from './app'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dist = join(root, 'dist')
const isProd = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT ?? 8787)

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')

  if (isProd) {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "worker-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        'upgrade-insecure-requests',
      ].join('; '),
    )
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

function serveStatic(res: ServerResponse, pathname: string): void {
  const decoded = decodeURIComponent(pathname.split('?')[0] ?? '/')
  const candidate = normalize(join(dist, decoded))
  if (!candidate.startsWith(dist + sep) && candidate !== dist) {
    res.writeHead(403).end('Forbidden')
    return
  }

  let file = candidate
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const indexPath = join(dist, 'index.html')
    if (!existsSync(indexPath)) {
      res.writeHead(503).end('Build not found. Run npm run build first.')
      return
    }
    file = indexPath
  }

  const ext = extname(file)
  const immutable = file.includes(`${sep}assets${sep}`) && ext !== '.html'
  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
  res.setHeader(
    'Cache-Control',
    immutable ? 'public, max-age=31536000, immutable' : 'no-cache, must-revalidate',
  )
  res.writeHead(200)
  createReadStream(file).pipe(res)
}

const apiListener = getRequestListener(api.fetch)

const vite = isProd
  ? null
  : await (
      await import('vite')
    ).createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })

const server = createServer((req, res) => {
  setSecurityHeaders(res)

  let pathname: string
  try {
    pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  } catch {
    res.writeHead(400).end('Bad request')
    return
  }

  if (pathname.startsWith('/api/')) {
    void apiListener(req, res)
    return
  }

  if (vite) {
    vite.middlewares(req, res, () => {
      res.writeHead(404).end('Not found')
    })
    return
  }

  serveStatic(res, pathname)
})

server.listen(port, () => {
  const mode = isProd ? 'production' : 'development'
  console.log(`SAANS (${mode}) → http://localhost:${port}`)
})

function shutdown(): void {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 4000).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
