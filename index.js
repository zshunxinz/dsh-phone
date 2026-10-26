/**
 * DSH plugin: mobile access.
 *
 * Host half. Serves three things the installed mobile web app needs, without
 * touching the DSH installation or its source tree:
 *
 *   GET /unlock                  a standalone token page (public). The launch
 *                                token is exchanged for the browser cookie by
 *                                the unchanged `GET /?token=...` path.
 *   GET /manifest.webmanifest    the stock manifest plus a `start_url` that
 *                                points the installed app at /unlock. `id`
 *                                stays the site root so a WebAPK updates in
 *                                place instead of appearing twice.
 *   GET /mobile-access/login-url an authenticated helper that returns the
 *                                current tokenized URL for a caller-supplied
 *                                base (the Settings section uses it).
 *   GET /mobile-access/networks  authenticated LAN address candidates.
 *
 * Only Node builtins are imported, so the same package directory runs on
 * Windows and Linux unchanged. Every registration is an effect owned by the
 * plugin fiber, so unloading restores the stock routes.
 */
import { networkInterfaces } from 'node:os'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { ICON_192, ICON_512, ICON_MASKABLE_512 } from './icon-data.js'

/** Stable Cordis plugin name. */
export const name = 'mobile-access'

/** Host services required before the routes can be claimed. */
export const inject = ['webServer']

const UNLOCK_PATH = '/unlock'
const MANIFEST_PATH = '/manifest.webmanifest'
const LOGIN_URL_PATH = '/mobile-access/login-url'
const NETWORKS_PATH = '/mobile-access/networks'
const ICON_192_PATH = '/mobile-access/icon-192.png'
const ICON_512_PATH = '/mobile-access/icon-512.png'
const ICON_MASKABLE_PATH = '/mobile-access/icon-maskable-512.png'
const VERSIONS_PATH = '/mobile-access/versions'
const UPDATE_PLUGIN_PATH = '/mobile-access/update-plugin'

/** Source of the plugin's own newer releases. */
const RELEASES_API = 'https://api.github.com/repos/zshunxinz/dsh-phone/releases'
const DSH_REGISTRY_API = 'https://registry.npmjs.org/@deepseek-ai/dsh/latest'
const VERSIONS_TTL_MS = 10 * 60 * 1000
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))

/** The stock Web app manifest with a token page as the launch target. */
const MANIFEST = {
  name: 'DeepSeek Harness',
  short_name: 'DSH',
  id: './',
  start_url: './unlock',
  scope: './',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#ffffff',
  icons: [
    { src: 'mobile-access/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'mobile-access/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'mobile-access/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

const MESSAGES = {
  zh: {
    title: '连接 DeepSeek Harness',
    subtitle: '输入访问令牌，这台设备会记住登录状态。',
    label: '访问令牌',
    placeholder: '粘贴令牌',
    submit: '连接',
    checking: '正在验证…',
    empty: '请先输入令牌。',
    bad: '令牌无效或已更新。请在运行 dsh web 的终端里复制最新地址中 token= 后面的部分。',
    forbidden: '该地址未被服务器信任。请把手机访问的主机名加入 dsh web 的 trustedHosts 配置，或改用电脑的局域网地址访问。',
    failed: '连接失败（HTTP %d）。',
    offline: '无法连接服务器。请确认电脑上的 dsh web 仍在运行，且手机与电脑在同一网络。',
    installSummary: '添加到主屏幕',
    installSteps: [
      '打开浏览器右上角的菜单（⋮ 或分享按钮）。',
      '选择“添加到主屏幕”。',
      '以后从主屏幕启动会先到这里；已登录时自动进入应用。',
    ],
    helpSummary: '令牌在哪里？',
    helpBody: '启动 dsh web 的终端会打印形如 http://…/?token=… 的地址，复制 token= 后面的部分即可。也可以在电脑端打开“设置 → 移动端访问”，复制令牌或生成二维码。',
    note: '令牌只在本机交换为 HttpOnly Cookie，页面不会保存它。',
  },
  en: {
    title: 'Connect to DeepSeek Harness',
    subtitle: 'Enter the access token. This device will remember the sign-in.',
    label: 'Access token',
    placeholder: 'Paste token',
    submit: 'Connect',
    checking: 'Checking…',
    empty: 'Enter a token first.',
    bad: 'The token is invalid or outdated. Copy the part after token= from the newest URL printed by the dsh web terminal.',
    forbidden: 'This address is not trusted by the server. Add the host name you use on the phone to the dsh web trustedHosts configuration, or use the computer LAN address.',
    failed: 'Connection failed (HTTP %d).',
    offline: 'Cannot reach the server. Keep dsh web running and make sure the phone is on the same network.',
    installSummary: 'Add to Home screen',
    installSteps: [
      'Open the browser menu (⋮ or the share sheet).',
      'Choose “Add to Home screen”.',
      'The home-screen app starts here and enters the app automatically once signed in.',
    ],
    helpSummary: 'Where is the token?',
    helpBody: 'The terminal that runs dsh web prints a URL like http://…/?token=…; copy the part after token=. You can also open Settings → Mobile access on the computer to copy the token or show a QR code.',
    note: 'The token is exchanged for an HttpOnly cookie on this host; this page stores nothing.',
  },
}

const UNLOCK_STYLE = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
html, body { min-height: 100%; }
body {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 18px calc(24px + env(safe-area-inset-bottom, 0px));
  background: #f6f7f9;
  color: #1f2329;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  -webkit-text-size-adjust: 100%;
}
.card {
  width: 100%;
  max-width: 380px;
  background: #ffffff;
  border-radius: 18px;
  padding: 26px 22px 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}
.brand { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
.mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 10px;
  background: #4176e6; color: #ffffff; font-weight: 600; font-size: 13px; letter-spacing: 0.5px;
}
h1 { font-size: 20px; line-height: 1.35; margin: 0 0 6px; }
.sub { margin: 0 0 20px; font-size: 13px; line-height: 1.6; color: #6b7280; }
label { display: block; font-size: 13px; color: #6b7280; margin: 0 0 6px; }
input {
  width: 100%; min-height: 48px; padding: 10px 12px; font-size: 16px;
  border-radius: 10px; border: 1px solid #d5d8de; background: transparent; color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
input:focus { outline: 2px solid #4176e6; outline-offset: 1px; border-color: transparent; }
button {
  width: 100%; min-height: 46px; margin-top: 12px; border: 0; border-radius: 10px;
  background: #4176e6; color: #ffffff; font-size: 15px; font-weight: 600; font-family: inherit;
}
button:disabled { opacity: 0.6; }
#status { min-height: 20px; margin: 10px 0 0; font-size: 13px; line-height: 1.5; }
#status[data-tone="error"] { color: #d92d20; }
#status[data-tone="ok"] { color: #079455; }
details { margin-top: 14px; font-size: 13px; color: #6b7280; }
details summary { cursor: pointer; }
details ol, details p { margin: 8px 0 0; padding-left: 18px; line-height: 1.7; }
footer { margin-top: 16px; text-align: center; font-size: 12px; color: #9ca3af; }
@media (prefers-color-scheme: dark) {
  body { background: #15161a; color: #ecedf0; }
  .card { background: #1e1f24; box-shadow: none; }
  input { border-color: #3a3d44; }
  .sub, label, details { color: #9ca3af; }
}
`

const UNLOCK_SCRIPT = `
(function () {
  var form = document.getElementById('form')
  var input = document.getElementById('token')
  var button = document.getElementById('submit')
  var status = document.getElementById('status')
  var install = document.getElementById('install')
  function say(text, tone) {
    status.textContent = text || ''
    if (tone) status.setAttribute('data-tone', tone)
    else status.removeAttribute('data-tone')
  }
  try {
    var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
    install.hidden = !!standalone
  } catch (error) { install.hidden = false }
  fetch('./', { method: 'HEAD', credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
    if (response.ok) window.location.replace('./')
    else if (response.status === 403) say(M.forbidden, 'error')
  }).catch(function () {})
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    var token = input.value.trim()
    if (!token) { say(M.empty, 'error'); input.focus(); return }
    button.disabled = true
    say(M.checking, '')
    fetch('./?token=' + encodeURIComponent(token), { credentials: 'same-origin', redirect: 'follow', cache: 'no-store' })
      .then(function (response) {
        if (response.ok) { window.location.replace('./'); return }
        if (response.status === 401) say(M.bad, 'error')
        else if (response.status === 403) say(M.forbidden, 'error')
        else say(M.failed.replace('%d', String(response.status)), 'error')
      })
      .catch(function () { say(M.offline, 'error') })
      .then(function () { button.disabled = false })
  })
  input.addEventListener('input', function () { if (status.textContent) say('', '') })
})()
`

/**
 * Pick the page language from an explicit override, then Accept-Language.
 * @param acceptLanguage - raw Accept-Language header value, if any.
 * @param override - `?lang=` value, if any.
 * @returns 'zh' or 'en'.
 */
function pickLanguage(acceptLanguage, override) {
  if (override === 'zh' || override === 'zh-CN' || override === 'zh-cn') return 'zh'
  if (override === 'en') return 'en'
  const text = String(acceptLanguage ?? '').toLowerCase()
  for (const part of text.split(',')) {
    const tag = part.trim().split(';')[0] ?? ''
    if (tag.startsWith('zh')) return 'zh'
    if (tag.startsWith('en')) return 'en'
  }
  return 'en'
}

/** Escape a value for a double-quoted HTML attribute. */
function escapeAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

/**
 * Build the standalone unlock page.
 * @param lang - resolved page language.
 * @returns complete HTML document text.
 */
function renderUnlockPage(lang) {
  const messages = MESSAGES[lang]
  const steps = messages.installSteps.map(step => `<li>${step}</li>`).join('')
  return `<!doctype html>
<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}" data-lang="${escapeAttribute(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${messages.title}</title>
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1e1f24" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="DSH">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="mobile-access/icon-192.png">
<style>${UNLOCK_STYLE}</style>
</head>
<body>
<main class="card">
  <div class="brand"><span class="mark">DSH</span></div>
  <h1>${messages.title}</h1>
  <p class="sub">${messages.subtitle}</p>
  <form id="form" autocomplete="off" novalidate>
    <label for="token">${messages.label}</label>
    <input id="token" name="token" type="text" inputmode="text" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="one-time-code" placeholder="${messages.placeholder}">
    <button id="submit" type="submit">${messages.submit}</button>
  </form>
  <p id="status" role="status" aria-live="polite"></p>
  <details id="install" hidden>
    <summary>${messages.installSummary}</summary>
    <ol>${steps}</ol>
  </details>
  <details>
    <summary>${messages.helpSummary}</summary>
    <p>${messages.helpBody}</p>
  </details>
  <footer>${messages.note}</footer>
</main>
<script>var M = ${JSON.stringify(messages)};${UNLOCK_SCRIPT}</script>
</body>
</html>`
}

/**
 * Write one response with explicit headers.
 * @param res - server response owner.
 * @param status - HTTP status code.
 * @param headers - header table.
 * @param body - body text, or undefined for an empty body (HEAD, 204).
 */
function send(res, status, headers, body) {
  res.statusCode = status
  for (const [headerName, value] of Object.entries(headers)) res.setHeader(headerName, value)
  res.end(body)
}

/**
 * Write a JSON response that must never be cached.
 * @param res - server response owner.
 * @param status - HTTP status code.
 * @param payload - JSON-serializable value.
 */
function sendJson(res, status, payload) {
  send(res, status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  }, JSON.stringify(payload))
}

/**
 * Format one host for a URL authority (brackets for IPv6).
 * @param host - bind host text.
 * @returns URL-safe authority text.
 */
function authorityOf(host) {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
}

/**
 * Normalize a caller-supplied base URL: http(s) only, no credentials, no
 * query or fragment, one trailing slash (a mount path is preserved).
 * @param raw - base URL candidate.
 * @returns the normalized base, or an error code.
 */
function normalizeBase(raw) {
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    return { error: 'invalid-base' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { error: 'invalid-base' }
  if (parsed.username !== '' || parsed.password !== '') return { error: 'invalid-base' }
  const path = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`
  return { base: `${parsed.origin}${path}` }
}

/**
 * Compare dotted versions: true only when the candidate sorts after the current
 * core version, so an older release can never overwrite the installed files.
 * @param candidate - version advertised by the release.
 * @param current - installed version.
 * @returns true when the candidate is newer.
 */
function isNewerVersion(candidate, current) {
  if (typeof candidate !== 'string' || typeof current !== 'string') return false
  const parse = (value) => value.replace(/^v/, '').split('-')[0].split('.').map((part) => Number.parseInt(part, 10) || 0)
  const a = parse(candidate)
  const b = parse(current)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return true
    if (a[index] < b[index]) return false
  }
  return candidate !== current
}

/**
 * Register the unlock page, the launch manifest, and the authenticated helpers.
 * @param ctx - Host context carrying `webServer`; `connection` is read when present.
 * @param _config - unused plugin config (the package declares none).
 */
export function apply(ctx) {
  const webServer = ctx.webServer

  const versionsState = { at: 0, value: null }

  function pluginVersion() {
    try {
      const manifest = JSON.parse(readFileSync(join(PLUGIN_DIR, 'package.json'), 'utf8'))
      return typeof manifest.version === 'string' ? manifest.version : null
    } catch {
      return null
    }
  }

  let dshVersion
  async function dshRuntimeVersion() {
    if (dshVersion !== undefined) return dshVersion
    try {
      const entry = process.argv[1]
      if (typeof entry === 'string') {
        const manifest = JSON.parse(readFileSync(join(dirname(entry), '..', 'package.json'), 'utf8'))
        if (manifest.name === '@deepseek-ai/dsh' && typeof manifest.version === 'string') {
          dshVersion = manifest.version
          return dshVersion
        }
      }
    } catch {
      // Not started from a CLI package layout; try the boot package below.
    }
    try {
      const module = await import('@deepseek-ai/dsh-app-boot')
      if (typeof module.getDshRuntimeVersion === 'function') {
        dshVersion = module.getDshRuntimeVersion()
        return dshVersion
      }
    } catch {
      // Unknown composition; the caller renders "unknown".
    }
    dshVersion = null
    return dshVersion
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'dsh-plugin-mobile-access' },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  async function versionsPayload(refresh) {
    if (!refresh && versionsState.value !== null && Date.now() - versionsState.at < VERSIONS_TTL_MS) {
      return versionsState.value
    }
    const [dshCurrent, dshLatest, pluginLatest] = await Promise.all([
      dshRuntimeVersion(),
      fetchJson(DSH_REGISTRY_API).then((payload) => typeof payload.version === 'string' ? payload.version : null).catch(() => null),
      fetchJson(`${RELEASES_API}/latest`).then((payload) => typeof payload.tag_name === 'string' ? payload.tag_name.replace(/^v/, '') : null).catch(() => null),
    ])
    const value = {
      dsh: {
        current: dshCurrent,
        latest: dshLatest,
        registry: 'https://www.npmjs.com/package/@deepseek-ai/dsh',
      },
      plugin: {
        current: pluginVersion(),
        latest: pluginLatest,
        releases: 'https://github.com/zshunxinz/dsh-phone/releases',
      },
    }
    versionsState.at = Date.now()
    versionsState.value = value
    return value
  }

  /** Minimal ustar reader: regular files only, `package/` entries mapped by the caller. */
  function untar(buffer) {
    const files = new Map()
    const text = (start, length) => {
      const slice = buffer.subarray(start, start + length)
      const end = slice.indexOf(0)
      return slice.subarray(0, end === -1 ? slice.length : end).toString('utf8')
    }
    let offset = 0
    while (offset + 512 <= buffer.length) {
      const header = buffer.subarray(offset, offset + 512)
      if (header.every((byte) => byte === 0)) break
      const name = text(offset, 100)
      const sizeText = text(offset + 124, 12).trim()
      const size = sizeText === '' ? 0 : Number.parseInt(sizeText, 8)
      const type = String.fromCharCode(header[156] ?? 0x30)
      const prefix = text(offset + 345, 155)
      const path = prefix === '' ? name : `${prefix}/${name}`
      const start = offset + 512
      if (type === '0' || type === '\0' || type === '') {
        files.set(path, buffer.subarray(start, start + size))
      }
      offset = start + Math.ceil(size / 512) * 512
    }
    return files
  }

  async function performPluginUpdate() {
    const release = await fetchJson(`${RELEASES_API}/latest`)
    const tag = typeof release.tag_name === 'string' ? release.tag_name.replace(/^v/, '') : null
    if (tag === null) throw new Error('release has no version tag')
    const current = pluginVersion()
    if (current === tag || (current !== null && !isNewerVersion(tag, current))) {
      return { updated: false, from: current, to: tag, reason: 'up-to-date' }
    }
    const asset = Array.isArray(release.assets)
      ? release.assets.find((entry) => typeof entry.name === 'string' && entry.name.endsWith('.tgz'))
      : undefined
    if (asset === undefined) throw new Error('release has no .tgz asset')
    const response = await fetch(asset.browser_download_url, {
      headers: { 'user-agent': 'dsh-plugin-mobile-access' },
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`)
    const files = untar(gunzipSync(Buffer.from(await response.arrayBuffer())))
    const manifestBytes = files.get('package/package.json')
    if (manifestBytes === undefined) throw new Error('tarball has no package.json')
    const manifest = JSON.parse(manifestBytes.toString('utf8'))
    if (manifest.name !== 'dsh-plugin-mobile-access') throw new Error('unexpected package name')
    const entries = []
    for (const [path, data] of files) {
      if (!path.startsWith('package/')) continue
      const relative = path.slice('package/'.length)
      if (relative === '' || relative.includes('..') || relative.startsWith('/') || relative.includes('\\')) continue
      const target = resolve(PLUGIN_DIR, relative)
      if (target !== PLUGIN_DIR && !target.startsWith(PLUGIN_DIR + sep)) continue
      entries.push({ relative, data, target })
    }
    if (entries.length === 0) throw new Error('tarball has no files')
    const backupDir = join(tmpdir(), `dsh-mobile-access-backup-${Date.now()}`)
    const backups = []
    try {
      for (const entry of entries) {
        if (!existsSync(entry.target)) continue
        const backup = join(backupDir, entry.relative)
        mkdirSync(dirname(backup), { recursive: true })
        copyFileSync(entry.target, backup)
        backups.push({ target: entry.target, backup })
      }
      for (const entry of entries) {
        mkdirSync(dirname(entry.target), { recursive: true })
        // Replace by rename so a pnpm hard-linked store copy is never edited in place.
        const temporary = `${entry.target}.new`
        writeFileSync(temporary, entry.data)
        renameSync(temporary, entry.target)
      }
    } catch (error) {
      for (const item of backups) {
        try {
          copyFileSync(item.backup, item.target)
        } catch {
          // Best effort: the update already failed; keep going through the rest.
        }
      }
      throw error
    } finally {
      rmSync(backupDir, { recursive: true, force: true })
    }
    versionsState.value = null
    versionsState.at = 0
    return { updated: true, from: current, to: tag, files: entries.length, restartRequired: true }
  }

  const versionsHandler = async (req, res) => {
    if ((req.method ?? 'GET') !== 'GET') {
      send(res, 405, { allow: 'GET', 'cache-control': 'no-store' }, '')
      return
    }
    const connection = ctx.get('connection')
    if (connection === undefined) {
      sendJson(res, 503, { error: 'connection-unavailable' })
      return
    }
    const admission = connection.admit({ headers: req.headers })
    if (admission.rejection !== undefined) {
      sendJson(res, admission.rejection, { error: admission.rejection === 403 ? 'untrusted-authority' : 'unauthenticated' })
      return
    }
    const url = new URL(req.url ?? VERSIONS_PATH, 'http://dsh.invalid')
    try {
      sendJson(res, 200, await versionsPayload(url.searchParams.get('refresh') === '1'))
    } catch {
      sendJson(res, 502, { error: 'registry-unreachable' })
    }
  }

  const updatePluginHandler = async (req, res) => {
    if ((req.method ?? 'GET') !== 'POST') {
      send(res, 405, { allow: 'POST', 'cache-control': 'no-store' }, '')
      return
    }
    const connection = ctx.get('connection')
    if (connection === undefined) {
      sendJson(res, 503, { error: 'connection-unavailable' })
      return
    }
    const admission = connection.admit({ headers: req.headers })
    if (admission.rejection !== undefined) {
      sendJson(res, admission.rejection, { error: admission.rejection === 403 ? 'untrusted-authority' : 'unauthenticated' })
      return
    }
    try {
      sendJson(res, 200, await performPluginUpdate())
    } catch (error) {
      sendJson(res, 500, { error: 'update-failed', detail: String(error?.message ?? error) })
    }
  }

  const unlockHandler = (req, res) => {
    const method = req.method ?? 'GET'
    if (method !== 'GET' && method !== 'HEAD') {
      send(res, 405, { allow: 'GET, HEAD', 'cache-control': 'no-store' }, '')
      return
    }
    const url = new URL(req.url ?? UNLOCK_PATH, 'http://dsh.invalid')
    const lang = pickLanguage(req.headers['accept-language'], url.searchParams.get('lang'))
    const html = renderUnlockPage(lang)
    send(res, 200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'self'",
    }, method === 'HEAD' ? undefined : html)
  }

  const manifestHandler = (req, res) => {
    const method = req.method ?? 'GET'
    if (method !== 'GET' && method !== 'HEAD') {
      send(res, 405, { allow: 'GET, HEAD', 'cache-control': 'no-store' }, '')
      return
    }
    send(res, 200, {
      'content-type': 'application/manifest+json',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    }, method === 'HEAD' ? undefined : JSON.stringify(MANIFEST, null, 2))
  }

  const loginUrlHandler = (req, res) => {
    if ((req.method ?? 'GET') !== 'GET') {
      send(res, 405, { allow: 'GET', 'cache-control': 'no-store' }, '')
      return
    }
    const connection = ctx.get('connection')
    if (connection === undefined) {
      sendJson(res, 503, { error: 'connection-unavailable' })
      return
    }
    const admission = connection.admit({ headers: req.headers })
    if (admission.rejection !== undefined) {
      sendJson(res, admission.rejection, { error: admission.rejection === 403 ? 'untrusted-authority' : 'unauthenticated' })
      return
    }
    const url = new URL(req.url ?? LOGIN_URL_PATH, 'http://dsh.invalid')
    const forwarded = String(req.headers['x-forwarded-proto'] ?? '').toLowerCase().startsWith('https') ? 'https:' : webServer.protocol
    const host = req.headers.host
    const requested = url.searchParams.get('base')
    const candidate = requested !== null && requested.trim() !== ''
      ? requested.trim()
      : host === undefined ? undefined : `${forwarded}//${host}/`
    if (candidate === undefined) {
      sendJson(res, 400, { error: 'missing-base' })
      return
    }
    const normalized = normalizeBase(candidate)
    if (normalized.base === undefined) {
      sendJson(res, 400, { error: normalized.error })
      return
    }
    let login
    try {
      login = connection.authenticatedUrl(normalized.base)
    } catch {
      sendJson(res, 409, { error: 'origin-unavailable' })
      return
    }
    sendJson(res, 200, { base: normalized.base, url: login })
  }

  const networksHandler = (req, res) => {
    if ((req.method ?? 'GET') !== 'GET') {
      send(res, 405, { allow: 'GET', 'cache-control': 'no-store' }, '')
      return
    }
    const connection = ctx.get('connection')
    if (connection === undefined) {
      sendJson(res, 503, { error: 'connection-unavailable' })
      return
    }
    const admission = connection.admit({ headers: req.headers })
    if (admission.rejection !== undefined) {
      sendJson(res, admission.rejection, { error: admission.rejection === 403 ? 'untrusted-authority' : 'unauthenticated' })
      return
    }
    const protocol = webServer.protocol
    const port = webServer.port ?? 0
    const host = String(webServer.host ?? '')
    const addresses = []
    const interfaces = networkInterfaces()
    for (const [interfaceName, entries] of Object.entries(interfaces)) {
      for (const entry of entries ?? []) {
        if (entry.family !== 'IPv4' || entry.internal) continue
        addresses.push({
          interface: interfaceName,
          address: entry.address,
          url: `${protocol}//${entry.address}:${port}/`,
        })
      }
    }
    const loopbackOnly = host === 'localhost' || host.startsWith('127.') || host === '::1' || host.startsWith('::ffff:127.')
    sendJson(res, 200, {
      host,
      port,
      protocol,
      loopbackOnly,
      addresses,
      unlock: `${protocol}//${authorityOf(host)}:${port}${UNLOCK_PATH}`,
    })
  }

  const iconHandler = (base64) => (req, res) => {
    const method = req.method ?? 'GET'
    if (method !== 'GET' && method !== 'HEAD') {
      send(res, 405, { allow: 'GET, HEAD', 'cache-control': 'no-store' }, '')
      return
    }
    const body = Buffer.from(base64, 'base64')
    send(res, 200, {
      'content-type': 'image/png',
      'content-length': String(body.length),
      'cache-control': 'public, max-age=31536000, immutable',
    }, method === 'HEAD' ? undefined : body)
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: UNLOCK_PATH,
    handler: unlockHandler,
  }), 'mobile-access: unlock page')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: MANIFEST_PATH,
    handler: manifestHandler,
  }), 'mobile-access: launch manifest')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ICON_192_PATH,
    handler: iconHandler(ICON_192),
  }), 'mobile-access: icon 192')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ICON_512_PATH,
    handler: iconHandler(ICON_512),
  }), 'mobile-access: icon 512')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ICON_MASKABLE_PATH,
    handler: iconHandler(ICON_MASKABLE_512),
  }), 'mobile-access: icon maskable 512')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: LOGIN_URL_PATH,
    handler: loginUrlHandler,
  }), 'mobile-access: login url')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: NETWORKS_PATH,
    handler: networksHandler,
  }), 'mobile-access: network candidates')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: VERSIONS_PATH,
    handler: versionsHandler,
  }), 'mobile-access: version check')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: UPDATE_PLUGIN_PATH,
    handler: updatePluginHandler,
  }), 'mobile-access: plugin update')

  ctx.get('logger')?.info?.('mobile access plugin mounted at %s', UNLOCK_PATH)
}
