import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import babel from '@babel/core'
import unicodePropertyRegex from '@babel/plugin-transform-unicode-property-regex'
import { Buffer } from 'node:buffer'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

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
      if (![
        '/api/translate',
        '/api/translate/batch',
        '/api/translate/stream'
      ].includes(requestPath)) {
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
        if (!upstream.body) {
          response.end()
          return
        }
        for await (const chunk of upstream.body) {
          if (!response.write(Buffer.from(chunk))) {
            await new Promise(resolve => response.once('drain', resolve))
          }
        }
        response.end()
      } catch (error) {
        next(error)
      }
    })
  }
})

const devHomePrerenderPlugin = () => ({
  name: 'planetmusic-dev-home-prerender',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const requestPath = request.url?.split('?')[0]
      if (request.method !== 'GET' || !['/', '/index.html'].includes(requestPath)) {
        next()
        return
      }

      try {
        const { default: HomeGuide } = await server.ssrLoadModule(
          '/src/Application/components/Core/HomeGuide.jsx'
        )
        const home = renderToString(
          React.createElement(
            MemoryRouter,
            { initialEntries: ['/'] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, {
                path: '/',
                element: React.createElement(HomeGuide, { isPlayerVisible: false })
              })
            )
          )
        )
        const header = `<header class="topbar static-topbar">
          <div class="topbar-left"><a class="logo-area" href="/" aria-label="PlanetMusic home"><h2 class="logo-text"><span class="pm-logo"><span class="pm-planet">PLANET</span><span class="pm-music">MUSIC</span></span></h2></a></div>
          <div class="topbar-right"><nav class="nav-menu" aria-label="Main navigation">
            <a class="nav-btn" href="/">Home</a><a class="nav-btn" href="/vault">Vault</a><a class="nav-btn" href="/ambient">Ambient</a>
            <a class="nav-btn" href="/zen">Zen</a><a class="nav-btn" href="/docs/dev-blogs">Docs</a>
            <a class="nav-btn" href="/docs/changelog">Changelog</a><a class="nav-btn" href="/contact">Contact</a>
          </nav></div>
        </header>`
        const footer = `<div class="global-footer">
          <p>© ${new Date().getFullYear()} PlanetMusic. All rights reserved.</p>
          <nav class="global-footer-links" aria-label="Legal and privacy">
            <a href="/privacy">Privacy Policy</a><a href="/docs/terms-of-service">Terms</a>
            <a href="/docs/about-me">About</a><a href="/contact">Contact</a>
          </nav>
        </div>`
        const template = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
        const html = template
          .replace(
            /<div id="root"><!--app-fallback-->[\s\S]*?<!--app-fallback-end-->\s*<\/div>/,
            `<div id="root">${header}<main class="static-dev-home">${home}</main>${footer}</div>`
          )
          .replace(
            '</head>',
            '<link rel="stylesheet" href="/src/App.css?direct" /><link rel="stylesheet" href="/src/Application/components/Core/HomeGuide.css?direct" /></head>'
          )
        const transformedHtml = await server.transformIndexHtml(request.url, html)
        response.statusCode = 200
        response.setHeader('content-type', 'text/html; charset=utf-8')
        response.end(transformedHtml)
      } catch (error) {
        next(error)
      }
    })
  }
})

const unicodePropertyRegexCompatibilityPlugin = () => ({
  name: 'planetmusic-unicode-property-regex-compatibility',
  enforce: 'pre',
  transform(source, id) {
    const file = id.split('?')[0]
    if (!/\.[jt]sx?$/.test(file) || file.includes('node_modules') || !source.includes('\\p{')) {
      return null
    }

    const result = babel.transformSync(source, {
      filename: file,
      babelrc: false,
      configFile: false,
      sourceMaps: true,
      parserOpts: { plugins: ['jsx'] },
      plugins: [unicodePropertyRegex]
    })

    return { code: result.code, map: result.map }
  }
})

export default defineConfig({
  plugins: [
    unicodePropertyRegexCompatibilityPlugin(),
    react(),
    legacy({
      targets: [
        'Chrome >= 64',
        'Firefox >= 60',
        'Safari >= 12',
        'Edge >= 79',
        'iOS >= 12'
      ],
      modernTargets: [
        'Chrome >= 64',
        'Firefox >= 60',
        'Safari >= 12',
        'Edge >= 79',
        'iOS >= 12'
      ],
      modernPolyfills: true
    }),
    translationEndpointPlugin(),
    devHomePrerenderPlugin()
  ],
  server: { host: true },
  css: {
    devSourcemap: true,
    modules: { localsConvention: 'camelCase' }
  },
  build: {
    cssTarget: ['chrome64', 'firefox60', 'safari12', 'edge79', 'ios12'],
    minify: 'terser',
    cssMinify: 'lightningcss'
  }
})