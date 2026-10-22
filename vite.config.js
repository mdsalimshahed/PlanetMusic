import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { onRequest as handleTranslationRequest } from './functions/api/translate.js'

const translationEndpointPlugin = () => ({
  name: 'planetmusic-translation-endpoint',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (request.url?.split('?')[0] !== '/api/translate') {
        next()
        return
      }

      try {
        const chunks = []
        let bodyLength = 0
        for await (const chunk of request) {
          bodyLength += chunk.length
          if (bodyLength > 20000) {
            response.writeHead(413, { 'content-type': 'application/json; charset=utf-8' })
            response.end(JSON.stringify({ error: 'Translation request is too large.' }))
            return
          }
          chunks.push(chunk)
        }

        const body = new Uint8Array(bodyLength)
        let bodyOffset = 0
        for (const chunk of chunks) {
          body.set(chunk, bodyOffset)
          bodyOffset += chunk.length
        }

        const headers = new Headers()
        for (const [name, value] of Object.entries(request.headers)) {
          if (typeof value === 'string') headers.set(name, value)
        }

        const method = request.method || 'GET'
        const edgeRequest = new Request(new URL(request.url, `http://${request.headers.host || 'localhost'}`), {
          method,
          headers,
          body: method === 'GET' || method === 'HEAD' ? undefined : body
        })
        const edgeResponse = await handleTranslationRequest({ request: edgeRequest })
        const responseHeaders = Object.fromEntries(edgeResponse.headers.entries())
        response.writeHead(edgeResponse.status, responseHeaders)
        response.end(new Uint8Array(await edgeResponse.arrayBuffer()))
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