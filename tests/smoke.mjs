/**
 * Dependency-free smoke test for the mobile-access plugin.
 *
 * Runs the Host half against a fake webserver/connection and the browser half
 * against a fake module loader, DOM, and React. It proves the routes answer,
 * the manifest is well formed, the token helper is gated, both halves apply,
 * and every `t()` key used by the Settings and overlay components exists in
 * both dictionaries.
 *
 * Usage: node tests/smoke.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = dirname(here)
const failures = []

function check(condition, message) {
  if (condition) {
    process.stdout.write(`ok   ${message}\n`)
    return
  }
  failures.push(message)
  process.stdout.write(`FAIL ${message}\n`)
}

function makeRes(out) {
  const res = {
    statusCode: out.status,
    setHeader(name, value) { out.headers[name.toLowerCase()] = value },
    end(body) { out.body = body },
  }
  Object.defineProperty(res, 'statusCode', {
    get() { return out.status },
    set(value) { out.status = value },
  })
  return res
}

function callRoute(handler, { method = 'GET', url = '/unlock', headers = {} } = {}) {
  const out = { status: 0, headers: {}, body: undefined }
  handler({ method, url, headers }, makeRes(out))
  return out
}

async function callRouteAsync(handler, { method = 'GET', url = '/unlock', headers = {} } = {}) {
  const out = { status: 0, headers: {}, body: undefined }
  await handler({ method, url, headers }, makeRes(out))
  return out
}

// ---------------------------------------------------------------- Host half

const routes = []
let connection
const host = await import(pathToFileURL(join(root, 'index.js')).href)
check(typeof host.apply === 'function', 'host half exports apply()')
check(Array.isArray(host.inject) && host.inject.includes('webServer'), 'host half injects webServer')
check(host.name === 'mobile-access', 'host half declares its plugin name')

const ctx = {
  webServer: {
    protocol: 'http:',
    port: 3080,
    host: '127.0.0.1',
    register(route) {
      routes.push(route)
      return () => {}
    },
  },
  get(service) {
    if (service === 'connection') return connection
    if (service === 'logger') return { info() {} }
    return undefined
  },
  effect(run) {
    const dispose = run()
    if (typeof dispose !== 'function') throw new Error('host effect must return a disposer')
    return dispose
  },
}

host.apply(ctx)

const byPath = new Map(routes.map((route) => [route.path, route]))
check(routes.length === 9, `host registers 9 routes (got ${routes.length})`)
check(byPath.get('/unlock')?.kind === 'prefix', 'unlock route is a prefix route')
check(byPath.get('/manifest.webmanifest')?.kind === 'exact', 'manifest route is exact')
check(byPath.get('/mobile-access/login-url')?.kind === 'exact', 'login-url route is exact')
check(byPath.get('/mobile-access/networks')?.kind === 'exact', 'networks route is exact')
check(byPath.get('/mobile-access/icon-192.png')?.kind === 'exact', 'icon-192 route is exact')
check(byPath.get('/mobile-access/icon-512.png')?.kind === 'exact', 'icon-512 route is exact')
check(byPath.get('/mobile-access/icon-maskable-512.png')?.kind === 'exact', 'maskable icon route is exact')
check(byPath.get('/mobile-access/versions')?.kind === 'exact', 'versions route is exact')
check(byPath.get('/mobile-access/update-plugin')?.kind === 'exact', 'update route is exact')

const unlock = callRoute(byPath.get('/unlock').handler, {
  headers: { 'accept-language': 'zh-CN,zh;q=0.9' },
})
check(unlock.status === 200, 'GET /unlock answers 200')
check(String(unlock.headers['content-type']).startsWith('text/html'), '/unlock is HTML')
check(String(unlock.body).includes('<form id="form"'), '/unlock renders the token form')
check(String(unlock.body).includes('rel="manifest"'), '/unlock links the launch manifest for installability')
check(String(unlock.body).includes('连接 DeepSeek Harness'), '/unlock follows Accept-Language (zh)')
check(!String(unlock.body).includes('dshm.base'), '/unlock does not contain the token or settings state')
check(String(unlock.headers['content-security-policy']).includes("script-src 'unsafe-inline'"), '/unlock ships a CSP')

const unlockHead = callRoute(byPath.get('/unlock').handler, { method: 'HEAD' })
check(unlockHead.status === 200 && unlockHead.body === undefined, 'HEAD /unlock has headers but no body')

const english = callRoute(byPath.get('/unlock').handler, {
  headers: { 'accept-language': 'en-US,en;q=0.9,zh;q=0.8' },
})
check(String(english.body).includes('Connect to DeepSeek Harness'), '/unlock follows Accept-Language (en)')

const unlockPost = callRoute(byPath.get('/unlock').handler, { method: 'POST' })
check(unlockPost.status === 405, 'POST /unlock answers 405')

const manifest = callRoute(byPath.get('/manifest.webmanifest').handler)
check(manifest.status === 200, 'GET /manifest.webmanifest answers 200')
const parsedManifest = JSON.parse(manifest.body)
check(parsedManifest.start_url === './unlock', 'manifest start_url points at the unlock page')
check(parsedManifest.id === './', 'manifest keeps the site-root id so installs update in place')
check(parsedManifest.scope === './', 'manifest keeps the site-root scope')
check(Array.isArray(parsedManifest.icons) && parsedManifest.icons.length === 3, 'manifest lists the plugin icons')
check(parsedManifest.icons[0].src === 'mobile-access/icon-192.png', 'manifest icon 192 is served by the plugin')
check(parsedManifest.icons[1].src === 'mobile-access/icon-512.png', 'manifest icon 512 is served by the plugin')
check(parsedManifest.icons[2].src === 'mobile-access/icon-maskable-512.png', 'manifest maskable icon is served by the plugin')

const icon192 = callRoute(byPath.get('/mobile-access/icon-192.png').handler)
check(icon192.status === 200, 'GET /mobile-access/icon-192.png answers 200')
check(String(icon192.headers['content-type']).startsWith('image/png'), 'icon route serves image/png')
check(icon192.body !== undefined && icon192.body.length > 1000, 'icon route serves real PNG bytes')
const iconHead = callRoute(byPath.get('/mobile-access/icon-512.png').handler, { method: 'HEAD' })
check(iconHead.status === 200 && iconHead.body === undefined, 'HEAD icon route has no body')

const loginDenied = callRoute(byPath.get('/mobile-access/login-url').handler, {
  headers: { host: '127.0.0.1:3080' },
})
check(loginDenied.status === 503, 'login-url answers 503 without a connection service')

connection = {
  admit() { return { rejection: 401 } },
  authenticatedUrl(base) { return base + '?token=secret' },
}
const loginUnauthenticated = callRoute(byPath.get('/mobile-access/login-url').handler, {
  headers: { host: '127.0.0.1:3080' },
})
check(loginUnauthenticated.status === 401, 'login-url refuses an unauthenticated caller')

connection = {
  admit() { return { peer: { id: 'peer' } } },
  authenticatedUrl(base) { return base + '?token=secret' },
}
const loginOk = callRoute(byPath.get('/mobile-access/login-url').handler, {
  url: '/mobile-access/login-url?base=http%3A%2F%2F192.168.1.10%3A3080',
  headers: { host: '127.0.0.1:3080' },
})
const loginPayload = JSON.parse(loginOk.body)
check(loginOk.status === 200, 'login-url answers an admitted caller')
check(loginPayload.base === 'http://192.168.1.10:3080/', 'login-url normalizes the trailing slash')
check(loginPayload.url === 'http://192.168.1.10:3080/?token=secret', 'login-url carries the process token')

const loginBadBase = callRoute(byPath.get('/mobile-access/login-url').handler, {
  url: '/mobile-access/login-url?base=javascript%3Aalert(1)',
  headers: { host: '127.0.0.1:3080' },
})
check(loginBadBase.status === 400, 'login-url rejects a non-http base')

const networks = callRoute(byPath.get('/mobile-access/networks').handler, {
  headers: { host: '127.0.0.1:3080' },
})
const networksPayload = JSON.parse(networks.body)
check(networks.status === 200, 'networks answers an admitted caller')
check(networksPayload.protocol === 'http:' && networksPayload.port === 3080, 'networks reports the listener facts')
check(networksPayload.loopbackOnly === true, 'networks flags a loopback-only listener')

const originalFetch = globalThis.fetch
globalThis.fetch = async (url) => ({
  ok: true,
  status: 200,
  json: async () => String(url).includes('registry.npmjs.org') ? { version: '9.9.9' } : { tag_name: 'v9.9.8' },
})
const versions = await callRouteAsync(byPath.get('/mobile-access/versions').handler, {
  headers: { host: '127.0.0.1:3080' },
})
globalThis.fetch = originalFetch
const versionsPayload = JSON.parse(versions.body)
check(versions.status === 200, 'versions answers an admitted caller')
check(versionsPayload.dsh.latest === '9.9.9', 'versions reads the npm registry')
check(versionsPayload.plugin.latest === '9.9.8', 'versions reads the GitHub release tag')
check(typeof versionsPayload.plugin.current === 'string', 'versions reports the installed plugin version')

connection = { admit() { return { rejection: 401 } } }
const versionsDenied = await callRouteAsync(byPath.get('/mobile-access/versions').handler, {
  headers: { host: '127.0.0.1:3080' },
})
check(versionsDenied.status === 401, 'versions refuses an unauthenticated caller')

const updateWrongMethod = await callRouteAsync(byPath.get('/mobile-access/update-plugin').handler, { method: 'GET' })
check(updateWrongMethod.status === 405, 'update route rejects GET')
const updateDenied = await callRouteAsync(byPath.get('/mobile-access/update-plugin').handler, { method: 'POST' })
check(updateDenied.status === 401, 'update route refuses an unauthenticated caller')

// ------------------------------------------------------------ Browser half

const source = await readFile(join(root, 'client.js'), 'utf8')

const dictionaryKeys = (language) => {
  const block = new RegExp(`const ${language} = \\{([\\s\\S]*?)\\n    \\}`, 'u').exec(source)
  if (block === null) throw new Error(`cannot find the ${language} dictionary`)
  return new Set([...block[1].matchAll(/^\s{6}([A-Za-z0-9_]+):/gmu)].map((match) => match[1]))
}
const zhKeys = dictionaryKeys('ZH')
const enKeys = dictionaryKeys('EN')

const usedKeys = []
const listeners = []
const registrations = []
const attributes = new Set()

function fakeElement() {
  return { dataset: {}, style: {}, textContent: '', remove() {}, setAttribute() {}, append() {} }
}

globalThis.window = {
  innerWidth: 390,
  innerHeight: 844,
  localStorage: {
    store: new Map(),
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null },
    setItem(key, value) { this.store.set(key, String(value)) },
  },
  addEventListener(name) { listeners.push(name) },
  removeEventListener() {},
  matchMedia() { return { matches: false } },
}
globalThis.document = {
  baseURI: 'http://127.0.0.1:3080/',
  head: { append() {} },
  body: { append() {} },
  documentElement: {
    toggleAttribute(name, on) {
      if (on) attributes.add(name)
      else attributes.delete(name)
    },
  },
  createElement: fakeElement,
  querySelector() { return null },
  execCommand() { return true },
}

let factory
globalThis.window.__ModuleLoader__ = {
  load(spec) { factory = spec },
}

const React = {
  Fragment: 'fragment',
  createElement(type, props, ...children) {
    return { type, props: props ?? {}, children }
  },
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}]
  },
  useEffect(run) {
    run()
  },
  useRef(value) {
    return { current: value }
  },
}

await import(pathToFileURL(join(root, 'client.js')).href)
check(factory !== undefined, 'client bundle registers one module factory')
check(factory.id === 'dsh-plugin-mobile-access', 'client module id is the package name')

const plugin = factory.factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require: ${name}`)
})
check(Array.isArray(plugin.inject), 'client plugin declares inject')
check(plugin.inject.includes('slots') && plugin.inject.includes('layout'), 'client plugin waits on slots and layout')

const clientCtx = {
  locale: {
    bind() {
      return (key) => {
        usedKeys.push(key)
        return key
      }
    },
    register() { return () => {} },
  },
  layout: { toggleSidebar() {} },
  slots: {
    inject(name, run) {
      registrations.push({ name, disposer: run() })
    },
    register(options, component) {
      registrations.push({ slot: options.name, options, component })
      return () => {}
    },
  },
  effect(run) {
    const dispose = run()
    if (typeof dispose !== 'function') throw new Error('client effect must return a disposer')
    return dispose
  },
}

plugin.apply(clientCtx)
check(attributes.has('data-dshm-sidebar'), 'sidebar preference projects data-dshm-sidebar')
check(!attributes.has('data-dshm-mobile'), 'no fixed viewport breakpoint attribute is projected')

const styleText = source.match(/const CSS = `([\s\S]*?)`\n\n    function readLocal/)?.[1] ?? ''
check(styleText.includes('@media (max-width: 1023px)'), 'sidebar rules follow the layout narrow breakpoint')
check(styleText.includes('@media (max-width: 720px)'), 'settings dialog switches to one column when narrow')
check(styleText.includes('[data-shortcut-modal="settings"]'), 'settings dialog is matched by its stable marker attribute')
check(!/_[A-Za-z]+_nav|_navList|_navCell/.test(styleText), 'settings CSS uses structure, not generated class names')
check(styleText.includes('grid-template-columns: 0px minmax(0px, 1fr) 0px'), 'collapsed sidebar drops every side track')
check(styleText.includes('.dshm-handle') && styleText.includes('data-dshm-edge'), 'edge handle docks to the left or right edge')
check(!styleText.includes('dshm-handle-grip'), 'edge handle keeps a single tap/drag surface')
check(styleText.includes('animation: dshm-drawer-in'), 'sidebar drawer slides in')
check(styleText.includes('@media (prefers-reduced-motion: reduce)'), 'motion respects prefers-reduced-motion')

const sectionRegistration = registrations.find((entry) => entry.slot === 'settings.section')
const overlayRegistration = registrations.find((entry) => entry.slot === 'shell.overlay')
check(sectionRegistration !== undefined, 'settings.section is registered')
check(overlayRegistration !== undefined, 'shell.overlay is registered')
check(sectionRegistration.options.order === 60, 'settings section keeps its place in the nav')
check(sectionRegistration.options.locale === 'mobileAccess', 'settings section owns its locale namespace')
check(typeof sectionRegistration.options.label === 'function', 'settings section label is a locale function')

const sectionProps = {
  t: (key) => {
    usedKeys.push(key)
    return key
  },
  prefs: { base: 'http://127.0.0.1:3080/', sidebar: true },
  savePrefs: (patch) => Object.assign({ base: '', sidebar: true }, patch),
  requestLogin: async () => ({ base: 'http://127.0.0.1:3080/', url: 'http://127.0.0.1:3080/?token=secret' }),
  requestNetworks: async () => ({ addresses: [], loopbackOnly: true }),
  close: () => {},
}
let sectionTree
try {
  sectionTree = sectionRegistration.component(sectionProps)
  check(sectionTree !== undefined, 'settings section renders a tree')
} catch (error) {
  check(false, `settings section renders without throwing (${error.message})`)
}

const overlayProps = {
  t: (key) => {
    usedKeys.push(key)
    return key
  },
  toggleSidebar: () => {},
}
try {
  overlayRegistration.component(overlayProps)
  check(true, 'edge handle renders without throwing')
} catch (error) {
  check(false, `edge handle renders without throwing (${error.message})`)
}

const missingZh = [...new Set(usedKeys)].filter((key) => !zhKeys.has(key))
const missingEn = [...new Set(usedKeys)].filter((key) => !enKeys.has(key))
check(missingZh.length === 0, `every used key exists in the zh dictionary${missingZh.length > 0 ? ` (missing: ${missingZh.join(', ')})` : ''}`)
check(missingEn.length === 0, `every used key exists in the en dictionary${missingEn.length > 0 ? ` (missing: ${missingEn.join(', ')})` : ''}`)

process.stdout.write(failures.length === 0 ? '\nsmoke: all checks passed\n' : `\nsmoke: ${failures.length} check(s) failed\n`)
process.exitCode = failures.length === 0 ? 0 : 1
