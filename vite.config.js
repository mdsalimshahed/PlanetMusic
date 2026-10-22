import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { Buffer } from 'node:buffer'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const loadDevVars = () => {
  const devVarsPath = resolve(process.cwd(), '.dev.vars')
  if (!existsSync(devVarsPath)) return {}

  return Object.fromEntries(
    readFileSync(devVarsPath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map(([, name, value]) => [name, value.replace(/^(['"])(.*)\1$/, '$2')])
  )
}

const devVars = loadDevVars()
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN
  || devVars.BACKEND_ORIGIN
  || 'https://ytdownloader-jnt0.onrender.com'
const BACKEND_GATEWAY_TOKEN = process.env.BACKEND_GATEWAY_TOKEN
  || devVars.BACKEND_GATEWAY_TOKEN
  || ''

const translationEndpointPlugin = () => ({
  name: 'planetmusic-translation-endpoint',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const requestPath = request.url?.split('?')[0]
      if (!['/api/translate', '/api/translate/batch'].includes(requestPath)) {
        next()
        return
      }

      if (request.method !== 'POST') {
        response.writeHead(405, {
          allow: 'POST',
          'content-type': 'application/json; charset=utf-8'
        })
        response.end(JSON.stringify({ error: 'Method not allowed.' }))
        return
      }

      try {
        const chunks = []
        let bodyLength = 0
        for await (const chunk of request) {
          bodyLength += chunk.length
          if (bodyLength > 220000) {
            response.writeHead(413, { 'content-type': 'application/json; charset=utf-8' })
            response.end(JSON.stringify({ error: 'Translation request is too large.' }))
            return
          }
          chunks.push(chunk)
        }

        const contentType = request.headers['content-type'] || ''
        if (!contentType.toLowerCase().startsWith('application/json')) {
          response.writeHead(415, { 'content-type': 'application/json; charset=utf-8' })
          response.end(JSON.stringify({ error: 'This endpoint requires JSON.' }))
          return
        }

        if (!BACKEND_GATEWAY_TOKEN) {
          response.writeHead(503, { 'content-type': 'application/json; charset=utf-8' })
          response.end(JSON.stringify({ error: 'Backend service configuration is unavailable.' }))
          return
        }

        const upstreamUrl = new URL(requestPath, BACKEND_ORIGIN)
        const upstream = await fetch(upstreamUrl, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': contentType,
            'X-Backend-Gateway-Token': BACKEND_GATEWAY_TOKEN
          },
          body: Buffer.concat(chunks),
          redirect: 'manual'
        })
        const responseHeaders = Object.fromEntries(upstream.headers.entries())
        response.writeHead(upstream.status, responseHeaders)
        response.end(Buffer.from(await upstream.arrayBuffer()))
      } catch (error) {
        next(error)
      }
    })
  }
})

export default defineConfig({
  plugins: [react(), translationEndpointPlugin()],
  server: { host: true },
  css: {
    devSourcemap: true,
    modules: { localsConvention: 'camelCase' }
  },
  build: { cssMinify: 'lightningcss' }
})