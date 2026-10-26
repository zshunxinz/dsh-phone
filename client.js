/**
 * DSH plugin: mobile access — browser half.
 *
 * Registers a Settings section that prepares the phone login, and a frame-wide
 * floating menu button that turns the narrow-viewport sidebar into a full
 * collapse plus an overlay drawer.
 *
 * Self-contained by design: only `react` is required from the shared module
 * table, so the package needs no build step and no workspace dependency.
 * All styling uses the app's global `--dsw-*` tokens and its own element data
 * attributes, so nothing depends on another package's CSS module names.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-mobile-access',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'mobileAccess'
    const KEY = {
      base: 'dshm.base',
      sidebar: 'dshm.sidebar',
    }

    const ZH = {
      nav: '移动端访问',
      openMenu: '打开菜单',
      sectionDesc: '为已安装到手机主屏幕的 DSH 准备访问令牌，并控制手机宽度下的侧边栏。',
      addressTitle: '访问地址',
      addressDesc: '手机要访问的地址。电脑上用 127.0.0.1 打开时，手机需要换成电脑的局域网地址或反向代理地址。',
      baseLabel: '对外访问地址',
      useCurrent: '使用当前地址',
      discover: '检测局域网地址',
      discovering: '检测中…',
      noNetwork: '没有找到可用的局域网地址。',
      loopbackHint: '当前 dsh web 只监听回环地址，手机无法直接访问。请用 dsh web --host <本机局域网IP> 重新启动，或使用反向代理。',
      linkTitle: '手机登录',
      linkDesc: '在手机浏览器打开下面的解锁页，输入令牌；已登录时自动进入应用。',
      unlockLabel: '解锁页地址',
      tokenLabel: '访问令牌',
      loginLabel: '一键登录链接（含令牌）',
      generate: '生成登录链接',
      generating: '生成中…',
      copy: '复制',
      copied: '已复制。',
      copyFailed: '复制失败，请手动选择文本。',
      open: '打开',
      installTitle: '安装到手机',
      installDesc: '安卓浏览器没有地址栏的“安装”入口时，用“添加到主屏幕”即可，打开后仍从这里进入。',
      step1: '在手机浏览器打开上面的解锁页地址。',
      step2: '输入访问令牌，确认进入应用。',
      step3: '浏览器菜单 → 添加到主屏幕；以后从主屏幕启动会先经过解锁页。',
      installWarn: '请从解锁页添加到主屏幕，不要从应用首页添加：首页图标会直接打开应用，签名失效时会停在未授权页面。',
      sidebarTitle: '侧边栏',
      sidebarDesc: '手机/窄屏下把侧边栏收到 0 宽，对话占满屏幕；由左边缘把手以覆盖层打开。宽度与把手位置都随窗口自适应，无需设置断点。',
      sidebarSwitch: '手机宽度下完全收起侧边栏',
      sidebarHint: '仅在窄屏（≤1023px）生效，桌面宽度下不变；关闭后立即恢复原生行为。',
      versionsTitle: '版本与更新',
      versionsDesc: '检查 DSH 运行时和本插件的新版本。',
      dshLabel: 'DSH 运行时',
      pluginLabel: '本插件',
      versionCurrent: '当前',
      versionLatest: '最新',
      versionUnknown: '未知',
      checkUpdates: '检查更新',
      checkingUpdates: '检查中…',
      versionUpToDate: '已是最新',
      versionOutdated: '有新版本',
      updatePlugin: '更新插件',
      updatingPlugin: '更新中…',
      pluginUpdated: '插件已更新到 v%s，刷新页面后生效；Host 部分需要重载插件行或重启 dsh web。',
      pluginUpToDate: '插件已是最新版本。',
      pluginUpdateFailed: '更新失败：%s',
      dshUpdateTitle: '更新 DSH',
      dshUpdateHint: 'DSH 是正在运行的服务，不能在应用内替换自身：停止当前进程后，用新版本重新启动（保留你原来的启动参数）。',
      copyUpdateCommand: '复制更新命令',
      versionsFailed: '检查失败，请确认服务器可以访问 npm / GitHub。',
      generated: '已生成。',
      forbidden: '服务器拒绝了该地址（403）。请检查 trustedHosts 配置。',
      expired: '登录状态已失效，请重新生成登录链接。',
      failed: '生成失败，请确认 dsh web 正在运行。',
      unknownBase: '请先填写有效的访问地址。',
    }

    const EN = {
      nav: 'Mobile access',
      openMenu: 'Open menu',
      sectionDesc: 'Prepare an access token for the DSH app installed on your phone, and control the sidebar at phone widths.',
      addressTitle: 'Access address',
      addressDesc: 'The address the phone opens. When the computer uses 127.0.0.1, the phone needs the LAN address or a reverse-proxy address.',
      baseLabel: 'Externally reachable address',
      useCurrent: 'Use current address',
      discover: 'Detect LAN addresses',
      discovering: 'Detecting…',
      noNetwork: 'No usable LAN address found.',
      loopbackHint: 'dsh web currently listens on a loopback address only, so the phone cannot reach it. Restart with dsh web --host <LAN IP>, or use a reverse proxy.',
      linkTitle: 'Phone sign-in',
      linkDesc: 'Open the unlock page below in the phone browser and enter the token; an already signed-in device goes straight to the app.',
      unlockLabel: 'Unlock page',
      tokenLabel: 'Access token',
      loginLabel: 'One-tap sign-in link (includes the token)',
      generate: 'Generate sign-in link',
      generating: 'Generating…',
      copy: 'Copy',
      copied: 'Copied.',
      copyFailed: 'Copy failed; select the text manually.',
      open: 'Open',
      installTitle: 'Install on the phone',
      installDesc: 'When the Android browser offers no install entry point, use “Add to Home screen”; the shortcut still starts here.',
      step1: 'Open the unlock page above in the phone browser.',
      step2: 'Enter the access token and confirm that the app opens.',
      step3: 'Browser menu → Add to Home screen; the home-screen app starts at the unlock page.',
      installWarn: 'Add the home-screen shortcut from the unlock page, not from the app root: a root shortcut opens the app directly and stops on the unauthorized page when the cookie is gone.',
      sidebarTitle: 'Sidebar',
      sidebarDesc: 'At phone/narrow widths the sidebar collapses to zero width and the conversation uses the whole screen; the left-edge handle opens it as an overlay. Widths and the docked position follow the window, so no breakpoint setting is needed.',
      sidebarSwitch: 'Fully collapse the sidebar at phone widths',
      sidebarHint: 'Applies below 1023px only; desktop widths are unchanged. Turning it off restores the stock behavior immediately.',
      versionsTitle: 'Version and updates',
      versionsDesc: 'Check for newer DSH runtime and plugin versions.',
      dshLabel: 'DSH runtime',
      pluginLabel: 'This plugin',
      versionCurrent: 'Current',
      versionLatest: 'Latest',
      versionUnknown: 'unknown',
      checkUpdates: 'Check for updates',
      checkingUpdates: 'Checking…',
      versionUpToDate: 'up to date',
      versionOutdated: 'update available',
      updatePlugin: 'Update plugin',
      updatingPlugin: 'Updating…',
      pluginUpdated: 'Plugin updated to v%s. Refresh the page; the Host half needs a plugin row reload or a dsh web restart.',
      pluginUpToDate: 'The plugin is already up to date.',
      pluginUpdateFailed: 'Update failed: %s',
      dshUpdateTitle: 'Update DSH',
      dshUpdateHint: 'DSH is the running service and cannot replace itself: stop the current process and start the new version with your original arguments.',
      copyUpdateCommand: 'Copy update command',
      versionsFailed: 'Check failed; make sure the server can reach npm and GitHub.',
      generated: 'Generated.',
      forbidden: 'The server refused this address (403). Check the trustedHosts configuration.',
      expired: 'The sign-in expired; generate a new link.',
      failed: 'Could not generate the link. Make sure dsh web is running.',
      unknownBase: 'Enter a valid access address first.',
    }

    const CSS = `
.dshm-page { max-width: 720px; padding: 2px 0 28px; font-size: 14px; line-height: 1.6; color: var(--dsw-alias-label-primary, #1f2329); }
.dshm-card { margin: 0 0 14px; padding: 16px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1)); border-radius: 12px; }
.dshm-card h3 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
.dshm-desc { margin: 0 0 12px; font-size: 13px; color: var(--dsw-alias-label-secondary, #4b5563); }
.dshm-label { display: block; margin: 0 0 6px; font-size: 13px; color: var(--dsw-alias-label-secondary, #4b5563); }
.dshm-input { box-sizing: border-box; width: 100%; min-height: 40px; padding: 8px 12px; font: inherit; font-size: 16px; color: inherit; background: transparent; border: 1px solid var(--dsw-alias-border-l3, rgba(0,0,0,.12)); border-radius: 8px; }
.dshm-input:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6); outline-offset: 1px; }
.dshm-input.dshm-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.dshm-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
.dshm-grow { flex: 1 1 240px; min-width: 0; }
.dshm-btn { min-height: 40px; padding: 0 14px; font: inherit; font-size: 13px; color: var(--dsw-alias-label-primary, #1f2329); background: transparent; border: 1px solid var(--dsw-alias-border-l3, rgba(0,0,0,.12)); border-radius: 8px; cursor: pointer; white-space: nowrap; }
.dshm-btn:hover { background: var(--dsw-alias-bg-overlay, rgba(0,0,0,.05)); }
.dshm-btn:disabled { opacity: .5; cursor: default; }
.dshm-btn-primary { color: #ffffff; background: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6); border-color: transparent; }
.dshm-btn-primary:hover { background: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6); filter: brightness(.95); }
.dshm-chip { min-height: 32px; padding: 0 10px; font: inherit; font-size: 12px; color: inherit; background: transparent; border: 1px dashed var(--dsw-alias-border-l3, rgba(0,0,0,.12)); border-radius: 999px; cursor: pointer; }
.dshm-chip:hover { border-style: solid; }
.dshm-hint { margin: 8px 0 0; font-size: 12px; color: var(--dsw-alias-label-tertiary, #6b7280); }
.dshm-status { margin: 10px 0 0; min-height: 20px; font-size: 13px; }
.dshm-status[data-tone="error"] { color: #d92d20; }
.dshm-status[data-tone="ok"] { color: #079455; }
.dshm-steps { margin: 10px 0 0; padding-left: 20px; font-size: 13px; color: var(--dsw-alias-label-secondary, #4b5563); }
.dshm-steps li { margin: 4px 0; }
.dshm-switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 40px; }
.dshm-switch-label { font-size: 13px; }
.dshm-check { width: 18px; height: 18px; margin: 0; accent-color: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6); }
.dshm-inline { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.dshm-select { min-height: 36px; padding: 0 8px; font: inherit; font-size: 13px; color: inherit; background: transparent; border: 1px solid var(--dsw-alias-border-l3, rgba(0,0,0,.12)); border-radius: 8px; }
.dshm-version-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06)); font-size: 13px; }
.dshm-version-row:last-of-type { border-bottom: 0; }
.dshm-version-value { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; color: var(--dsw-alias-label-secondary, #4b5563); }
.dshm-version-state[data-tone="ok"] { color: #079455; }
.dshm-version-state[data-tone="warn"] { color: #b54708; }

/* Floating menu button and the mobile sidebar treatment. The rule set is gated
   by the layout's own narrow breakpoint, so neither the breakpoint nor the
   drawer width is a user setting: any narrow DSH window or phone gets it. */
/* Dockable edge handle: drag it anywhere; on release it snaps to the nearest
   edge (left or right) and keeps its vertical ratio. A tap opens the sidebar. */
.dshm-handle { display: flex; position: fixed; left: 0; top: 0; z-index: 21; width: 26px; height: 56px; padding: 0; align-items: center; justify-content: center; color: var(--dsw-alias-label-primary, #1f2329); background: var(--dsw-alias-bg-base, #ffffff); border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1)); border-left: 0; border-radius: 0 12px 12px 0; box-shadow: 1px 2px 10px rgba(0,0,0,.14); touch-action: none; cursor: pointer; opacity: 0; pointer-events: none; transform: translateX(-110%); will-change: left, top, width, height, border-radius; transition: left .2s cubic-bezier(.2,.8,.2,1), top .2s cubic-bezier(.2,.8,.2,1), width .18s cubic-bezier(.2,.8,.2,1), height .18s cubic-bezier(.2,.8,.2,1), border-radius .18s cubic-bezier(.2,.8,.2,1), opacity .16s ease, transform .18s ease, box-shadow .18s ease; }
.dshm-handle[data-dshm-edge="right"] { border-left: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1)); border-right: 0; border-radius: 12px 0 0 12px; box-shadow: -1px 2px 10px rgba(0,0,0,.14); transform: translateX(110%); }
.dshm-handle[data-dshm-dragging] { width: 44px; height: 44px; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1)); border-radius: 50%; box-shadow: 0 8px 24px rgba(0,0,0,.28); cursor: grabbing; transition: width .18s cubic-bezier(.2,.8,.2,1), height .18s cubic-bezier(.2,.8,.2,1), border-radius .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s ease; }
.dshm-backdrop { display: block; position: fixed; inset: 0; z-index: 29; background: rgba(0,0,0,.35); opacity: 0; pointer-events: none !important; transition: opacity .2s ease; }

@keyframes dshm-drawer-in {
  from { transform: translateX(-100%); }
  to { transform: none; }
}

@media (max-width: 1023px) {
  html[data-dshm-sidebar] [data-sidebar-collapsed] .dshm-handle { opacity: 1; transform: none; pointer-events: auto; }
  html[data-dshm-sidebar] :has(> [data-shell-overlay]) { grid-template-columns: 0px minmax(0px, 1fr) 0px !important; }
  html[data-dshm-sidebar] [data-side] { display: none !important; }
  html[data-dshm-sidebar] [data-sidebar-collapsed] > div:first-child { border-right: none !important; }
  /* The column stays in flow so grid placement never shifts, but it grows past
     its zero-width track, slides in, and paints above the conversation. */
  html[data-dshm-sidebar] :has(> [data-shell-overlay]):not([data-sidebar-collapsed]) > div:first-child { position: relative; z-index: 30; overflow: visible !important; border-right: none !important; animation: dshm-drawer-in .22s cubic-bezier(.2,.8,.2,1); }
  html[data-dshm-sidebar] :has(> [data-shell-overlay]):not([data-sidebar-collapsed]) .dshm-backdrop { opacity: 1; pointer-events: auto !important; }
}

@media (prefers-reduced-motion: reduce) {
  .dshm-handle, .dshm-backdrop { transition: none; }
  html[data-dshm-sidebar] :has(> [data-shell-overlay]):not([data-sidebar-collapsed]) > div:first-child { animation: none; }
}

/* Settings dialog: two columns do not fit a phone. One column, the section list
   becomes a horizontal chip strip, and the header actions float top-right.
   Selectors use the dialog's own structure and its stable marker attribute, not
   generated class names, so a DSH rebuild keeps matching. */
@media (max-width: 720px) {
  [data-shortcut-modal="settings"] {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: auto auto minmax(0, 1fr) !important;
    width: calc(100vw - 12px) !important;
    max-width: none !important;
    height: calc(100vh - 12px) !important;
    height: calc(100dvh - 12px) !important;
    max-height: none !important;
    border-radius: 16px !important;
  }
  [data-shortcut-modal="settings"] > nav { display: contents !important; }
  [data-shortcut-modal="settings"] > nav > :first-child { grid-row: 1; padding: 14px 16px 2px !important; }
  [data-shortcut-modal="settings"] > nav > :last-child {
    grid-row: 2;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    overflow: visible !important;
    gap: 6px !important;
    padding: 2px 16px 8px !important;
  }
  [data-shortcut-modal="settings"] > nav > :last-child > button {
    flex: none !important;
    height: 32px !important;
    padding: 3px 10px !important;
    font-size: 13px !important;
    border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12));
    border-radius: 999px !important;
  }
  [data-shortcut-modal="settings"] > nav > :last-child > button > svg { width: 14px; height: 14px; }
  [data-shortcut-modal="settings"] > nav > :last-child > button > span { flex: none !important; white-space: nowrap !important; }
  [data-shortcut-modal="settings"] > div { grid-row: 3; min-height: 0 !important; }
  [data-shortcut-modal="settings"] > div > :first-child {
    position: absolute !important;
    top: 6px !important;
    right: 6px !important;
    z-index: 3 !important;
    height: auto !important;
    padding: 0 !important;
  }
  [data-shortcut-modal="settings"] > div > :last-child { padding: 4px 16px 16px !important; }
}
`

    function readLocal(key, fallback) {
      try {
        const value = window.localStorage.getItem(key)
        return value === null ? fallback : value
      } catch {
        return fallback
      }
    }

    function writeLocal(key, value) {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // Storage can be unavailable (private mode); the feature then lasts for this page only.
      }
    }

    function loadPrefs() {
      return {
        base: readLocal(KEY.base, ''),
        sidebar: readLocal(KEY.sidebar, '1') !== '0',
      }
    }

    /** Project the persisted preferences onto the document element. */
    function syncDocument(prefs) {
      document.documentElement.toggleAttribute('data-dshm-sidebar', prefs.sidebar === true)
    }

    function savePrefs(patch) {
      const next = Object.assign(loadPrefs(), patch)
      writeLocal(KEY.base, next.base)
      writeLocal(KEY.sidebar, next.sidebar ? '1' : '0')
      syncDocument(next)
      return next
    }

    const HANDLE = { width: 26, height: 56, margin: 12, dragSize: 44 }

    function clamp01(value) {
      return Math.min(1, Math.max(0, value))
    }

    /** Compare dotted versions; a differing core is newer only when it sorts after. */
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

    /** Read the docked edge and vertical ratio, migrating the old anchor strings. */
    function readPlacement() {
      const raw = readLocal('dshm.handle', '')
      if (raw === 'top') return { edge: 'left', ratio: 0 }
      if (raw === 'bottom') return { edge: 'left', ratio: 1 }
      try {
        const parsed = JSON.parse(raw)
        if (parsed !== null && typeof parsed === 'object'
          && (parsed.edge === 'left' || parsed.edge === 'right')
          && Number.isFinite(Number(parsed.ratio))) {
          return { edge: parsed.edge, ratio: clamp01(Number(parsed.ratio)) }
        }
      } catch {
        // A pre-JSON value falls through to the default.
      }
      return { edge: 'left', ratio: 0.5 }
    }

    function writePlacement(placement) {
      writeLocal('dshm.handle', JSON.stringify(placement))
    }

    /** Pixel position of the docked handle for the current viewport. */
    function positionFor(edge, ratio) {
      const usable = Math.max(0, window.innerHeight - 2 * HANDLE.margin - HANDLE.height)
      return {
        left: edge === 'right' ? Math.max(0, window.innerWidth - HANDLE.width) : 0,
        top: HANDLE.margin + clamp01(ratio) * usable,
      }
    }

    async function readJson(path) {
      const response = await fetch(path, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        const error = new Error('HTTP ' + response.status)
        error.status = response.status
        throw error
      }
      return response.json()
    }

    function requestLogin(base) {
      const query = base ? '?base=' + encodeURIComponent(base) : ''
      return readJson('/mobile-access/login-url' + query)
    }

    function requestNetworks() {
      return readJson('/mobile-access/networks')
    }

    function copyText(text) {
      const fallback = () => {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.append(area)
        area.select()
        const ok = document.execCommand('copy')
        area.remove()
        return ok
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(() => true, () => fallback())
      }
      return Promise.resolve(fallback())
    }

    function normalizeBaseText(text) {
      try {
        const url = new URL(text)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
        const path = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/'
        return url.origin + path
      } catch {
        return ''
      }
    }

    /** The address this page was served from, trailing slash included. */
    function currentBase() {
      try {
        return new URL('./', document.baseURI).href
      } catch {
        return window.location.origin + '/'
      }
    }

    /** Resolve the unlock page against a base that may carry a mount path. */
    function unlockUrlOf(base) {
      try {
        return new URL('unlock', base).href
      } catch {
        return ''
      }
    }

    function Section(props) {
      const t = props.t
      const [prefs, setPrefs] = React.useState(props.prefs)
      const [base, setBase] = React.useState(props.prefs.base || currentBase())
      const [link, setLink] = React.useState('')
      const [status, setStatus] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [networks, setNetworks] = React.useState(null)
      const [discovering, setDiscovering] = React.useState(false)
      const [versions, setVersions] = React.useState(null)
      const [versionsLoading, setVersionsLoading] = React.useState(false)
      const [versionsError, setVersionsError] = React.useState(false)
      const [updating, setUpdating] = React.useState(false)
      const [updateStatus, setUpdateStatus] = React.useState(null)

      const normalizedBase = normalizeBaseText(base)
      const unlockUrl = normalizedBase ? unlockUrlOf(normalizedBase) : ''
      let token = ''
      if (link) {
        try {
          token = new URL(link).searchParams.get('token') || ''
        } catch {
          token = ''
        }
      }

      const applyPrefs = (patch) => {
        const next = props.savePrefs(patch)
        setPrefs(next)
        if (patch.sidebar !== undefined) syncDocument(next)
        return next
      }

      const copy = (text, done) => {
        if (!text) return
        copyText(text).then((ok) => {
          if (done !== undefined) done()
          setStatus({ tone: ok ? 'ok' : 'error', text: ok ? t('copied') : t('copyFailed') })
        })
      }

      const generate = () => {
        if (!normalizedBase) {
          setStatus({ tone: 'error', text: t('unknownBase') })
          return
        }
        setBusy(true)
        setStatus(null)
        requestLogin(normalizedBase).then((result) => {
          setLink(result.url)
          applyPrefs({ base: result.base })
          setBase(result.base)
          setStatus({ tone: 'ok', text: t('generated') })
        }).catch((error) => {
          const tone = 'error'
          const text = error.status === 403 ? t('forbidden')
            : error.status === 401 ? t('expired')
              : t('failed')
          setStatus({ tone, text })
        }).then(() => { setBusy(false) })
      }

      const discover = () => {
        setDiscovering(true)
        setStatus(null)
        requestNetworks().then((result) => {
          setNetworks(result)
          if (result.addresses.length === 0) setStatus({ tone: 'error', text: t('noNetwork') })
        }).catch(() => {
          setStatus({ tone: 'error', text: t('failed') })
        }).then(() => { setDiscovering(false) })
      }

      const loadVersions = (refresh) => {
        setVersionsLoading(true)
        setVersionsError(false)
        const path = '/mobile-access/versions' + (refresh ? '?refresh=1' : '')
        Promise.resolve()
          .then(() => fetch(path, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } }))
          .then((response) => {
            if (!response.ok) throw new Error('HTTP ' + response.status)
            return response.json()
          })
          .then((payload) => { setVersions(payload); setVersionsError(false) })
          .catch(() => { setVersionsError(true) })
          .then(() => { setVersionsLoading(false) })
      }
      React.useEffect(() => { loadVersions(false) }, [])

      const updatePlugin = () => {
        setUpdating(true)
        setUpdateStatus(null)
        Promise.resolve()
          .then(() => fetch('/mobile-access/update-plugin', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { accept: 'application/json' },
          }))
          .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
          .then(({ ok, payload }) => {
            if (!ok) {
              setUpdateStatus({ tone: 'error', text: t('pluginUpdateFailed').replace('%s', String(payload?.detail ?? payload?.error ?? 'HTTP')) })
              return
            }
            if (payload.updated === true) {
              setUpdateStatus({ tone: 'ok', text: t('pluginUpdated').replace('%s', String(payload.to)) })
              setVersions((current) => current === null ? current : {
                ...current,
                plugin: { ...current.plugin, current: payload.to },
              })
            } else {
              setUpdateStatus({ tone: 'ok', text: t('pluginUpToDate') })
            }
          })
          .catch(() => {
            setUpdateStatus({ tone: 'error', text: t('pluginUpdateFailed').replace('%s', 'network') })
          })
          .then(() => { setUpdating(false) })
      }

      const footer = status === null ? null : h('p', {
        className: 'dshm-status',
        'data-tone': status.tone,
        role: 'status',
      }, status.text)

      const dshOutdated = versions !== null && isNewerVersion(versions.dsh.latest, versions.dsh.current)
      const pluginOutdated = versions !== null && isNewerVersion(versions.plugin.latest, versions.plugin.current)

      return h('div', { className: 'dshm-page' },
        h('p', { className: 'dshm-desc' }, t('sectionDesc')),

        h('section', { className: 'dshm-card' },
          h('h3', null, t('addressTitle')),
          h('p', { className: 'dshm-desc' }, t('addressDesc')),
          h('label', { className: 'dshm-label', htmlFor: 'dshm-base' }, t('baseLabel')),
          h('input', {
            id: 'dshm-base',
            className: 'dshm-input',
            type: 'text',
            inputMode: 'url',
            spellCheck: false,
            autoCapitalize: 'off',
            autoCorrect: 'off',
            placeholder: 'http://192.168.1.10:3080/',
            value: base,
            onChange: (event) => { setBase(event.target.value) },
            onBlur: () => { applyPrefs({ base: normalizeBaseText(base) || base }) },
          }),
          h('div', { className: 'dshm-row' },
            h('button', {
              type: 'button',
              className: 'dshm-btn',
              onClick: () => {
                const current = currentBase()
                setBase(current)
                applyPrefs({ base: current })
              },
            }, t('useCurrent')),
            h('button', {
              type: 'button',
              className: 'dshm-btn',
              disabled: discovering,
              onClick: discover,
            }, discovering ? t('discovering') : t('discover'))),
          networks !== null && networks.addresses.length > 0
            ? h('div', { className: 'dshm-row' }, networks.addresses.map((entry) => h('button', {
              key: entry.interface + entry.address,
              type: 'button',
              className: 'dshm-chip',
              title: entry.interface,
              onClick: () => { setBase(entry.url); applyPrefs({ base: entry.url }) },
            }, entry.url)))
            : null,
          networks !== null && networks.loopbackOnly
            ? h('p', { className: 'dshm-hint' }, t('loopbackHint'))
            : null),

        h('section', { className: 'dshm-card' },
          h('h3', null, t('linkTitle')),
          h('p', { className: 'dshm-desc' }, t('linkDesc')),
          h('label', { className: 'dshm-label' }, t('unlockLabel')),
          h('div', { className: 'dshm-row' },
            h('input', { className: 'dshm-input dshm-mono dshm-grow', type: 'text', readOnly: true, value: unlockUrl }),
            h('button', { type: 'button', className: 'dshm-btn', onClick: () => copy(unlockUrl) }, t('copy'))),
          h('div', { className: 'dshm-row' },
            h('button', { type: 'button', className: 'dshm-btn dshm-btn-primary', disabled: busy, onClick: generate }, busy ? t('generating') : t('generate'))),
          link
            ? h('div', null,
              h('label', { className: 'dshm-label' }, t('loginLabel')),
              h('div', { className: 'dshm-row' },
                h('input', { className: 'dshm-input dshm-mono dshm-grow', type: 'text', readOnly: true, value: link }),
                h('button', { type: 'button', className: 'dshm-btn', onClick: () => copy(link) }, t('copy')),
                h('button', {
                  type: 'button',
                  className: 'dshm-btn',
                  onClick: () => { window.open(link, '_blank', 'noopener,noreferrer') },
                }, t('open'))),
              token
                ? h('div', null,
                  h('label', { className: 'dshm-label' }, t('tokenLabel')),
                  h('div', { className: 'dshm-row' },
                    h('input', { className: 'dshm-input dshm-mono dshm-grow', type: 'text', readOnly: true, value: token }),
                    h('button', { type: 'button', className: 'dshm-btn', onClick: () => copy(token) }, t('copy'))))
                : null)
            : null,
          footer),

        h('section', { className: 'dshm-card' },
          h('h3', null, t('installTitle')),
          h('p', { className: 'dshm-desc' }, t('installDesc')),
          h('ol', { className: 'dshm-steps' },
            h('li', null, t('step1')),
            h('li', null, t('step2')),
            h('li', null, t('step3'))),
          h('p', { className: 'dshm-hint' }, t('installWarn'))),

        h('section', { className: 'dshm-card' },
          h('h3', null, t('sidebarTitle')),
          h('p', { className: 'dshm-desc' }, t('sidebarDesc')),
          h('div', { className: 'dshm-switch' },
            h('span', { className: 'dshm-switch-label' }, t('sidebarSwitch')),
            h('input', {
              className: 'dshm-check',
              type: 'checkbox',
              checked: prefs.sidebar,
              onChange: (event) => { applyPrefs({ sidebar: event.target.checked }) },
            })),
          h('p', { className: 'dshm-hint' }, t('sidebarHint'))),

        h('section', { className: 'dshm-card' },
          h('h3', null, t('versionsTitle')),
          h('p', { className: 'dshm-desc' }, t('versionsDesc')),
          versions !== null
            ? h('div', null,
              h('div', { className: 'dshm-version-row' },
                h('span', null, t('dshLabel')),
                h('span', { className: 'dshm-version-value' }, `${versions.dsh.current ?? t('versionUnknown')} → ${versions.dsh.latest ?? t('versionUnknown')}`),
                h('span', {
                  className: 'dshm-version-state',
                  'data-tone': dshOutdated ? 'warn' : 'ok',
                }, dshOutdated ? t('versionOutdated') : t('versionUpToDate'))),
              h('div', { className: 'dshm-version-row' },
                h('span', null, t('pluginLabel')),
                h('span', { className: 'dshm-version-value' }, `${versions.plugin.current ?? t('versionUnknown')} → ${versions.plugin.latest ?? t('versionUnknown')}`),
                h('span', {
                  className: 'dshm-version-state',
                  'data-tone': pluginOutdated ? 'warn' : 'ok',
                }, pluginOutdated ? t('versionOutdated') : t('versionUpToDate'))))
            : h('p', { className: 'dshm-hint' }, versionsLoading ? t('checkingUpdates') : versionsError ? t('versionsFailed') : ''),
          h('div', { className: 'dshm-row' },
            h('button', {
              type: 'button',
              className: 'dshm-btn',
              disabled: versionsLoading,
              onClick: () => { loadVersions(true) },
            }, versionsLoading ? t('checkingUpdates') : t('checkUpdates')),
            h('button', {
              type: 'button',
              className: 'dshm-btn dshm-btn-primary',
              disabled: updating,
              onClick: updatePlugin,
            }, updating ? t('updatingPlugin') : t('updatePlugin'))),
          dshOutdated
            ? h('div', null,
              h('p', { className: 'dshm-hint' }, t('dshUpdateHint')),
              h('div', { className: 'dshm-row' },
                h('button', {
                  type: 'button',
                  className: 'dshm-btn',
                  onClick: () => copy('npx -y @deepseek-ai/dsh@latest web'),
                }, t('copyUpdateCommand'))))
            : null,
          updateStatus === null ? null : h('p', {
            className: 'dshm-status',
            'data-tone': updateStatus.tone,
            role: 'status',
          }, updateStatus.text)))
    }

    /** Dockable edge handle: tap opens the sidebar; drag it anywhere, release snaps to the nearest edge. */
    function FloatingMenu(props) {
      const [placement, setPlacement] = React.useState(readPlacement)
      const [dragPos, setDragPos] = React.useState(null)
      const [, setViewportTick] = React.useState(0)
      const drag = React.useRef(null)
      const suppressClick = React.useRef(false)

      React.useEffect(() => {
        const onResize = () => { setViewportTick((tick) => tick + 1) }
        window.addEventListener('resize', onResize)
        window.addEventListener('orientationchange', onResize)
        return () => {
          window.removeEventListener('resize', onResize)
          window.removeEventListener('orientationchange', onResize)
        }
      }, [])

      const resting = positionFor(placement.edge, placement.ratio)
      const position = dragPos ?? resting

      const endDrag = (event, cancelled) => {
        const state = drag.current
        if (state === null) return
        drag.current = null
        if (state.moved) suppressClick.current = true
        if (event.currentTarget.hasPointerCapture(state.id)) event.currentTarget.releasePointerCapture(state.id)
        if (cancelled || !state.moved) {
          setDragPos(null)
          if (state.moved) window.setTimeout(() => { suppressClick.current = false }, 300)
          return
        }
        const final = state.latest ?? { centerX: state.startX, centerY: state.startY }
        const edge = final.centerX < window.innerWidth / 2 ? 'left' : 'right'
        const usable = Math.max(0, window.innerHeight - 2 * HANDLE.margin - HANDLE.height)
        const ratio = usable === 0 ? 0 : clamp01((final.centerY - HANDLE.margin - HANDLE.height / 2) / usable)
        setPlacement({ edge, ratio })
        writePlacement({ edge, ratio })
        setDragPos(null)
        window.setTimeout(() => { suppressClick.current = false }, 300)
      }

      return h(React.Fragment, null,
        h('div', {
          className: 'dshm-backdrop',
          'data-dshm-backdrop': '',
          onClick: () => {
            if (document.querySelector('[data-sidebar-collapsed]') === null) props.toggleSidebar()
          },
        }),
        h('button', {
          type: 'button',
          className: 'dshm-handle',
          'data-dshm-edge': placement.edge,
          'data-dshm-dragging': dragPos === null ? undefined : '',
          style: { left: position.left + 'px', top: position.top + 'px' },
          'aria-label': props.t('openMenu'),
          title: props.t('openMenu'),
          onPointerDown: (event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            drag.current = {
              id: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              offsetX: event.clientX - (rect.left + rect.width / 2),
              offsetY: event.clientY - (rect.top + rect.height / 2),
              latest: null,
              moved: false,
            }
            event.currentTarget.setPointerCapture(event.pointerId)
          },
          onPointerMove: (event) => {
            const state = drag.current
            if (state === null || state.id !== event.pointerId) return
            const dx = event.clientX - state.startX
            const dy = event.clientY - state.startY
            if (!state.moved && Math.abs(dx) + Math.abs(dy) > 6) state.moved = true
            if (!state.moved) return
            const half = HANDLE.dragSize / 2
            const left = Math.min(window.innerWidth - HANDLE.dragSize, Math.max(0, event.clientX - state.offsetX - half))
            const top = Math.min(window.innerHeight - HANDLE.dragSize, Math.max(0, event.clientY - state.offsetY - half))
            const next = { left, top, centerX: left + half, centerY: top + half }
            state.latest = next
            setDragPos({ left, top })
          },
          onPointerUp: (event) => { endDrag(event, false) },
          onPointerCancel: (event) => { endDrag(event, true) },
          onClick: () => {
            if (suppressClick.current) return
            props.toggleSidebar()
          },
        }, h('svg', {
          viewBox: '0 0 24 24',
          width: 14,
          height: 14,
          'aria-hidden': true,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2.2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }, h('path', { d: placement.edge === 'left' ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6' }))))
    }

    return {
      inject: ['slots', 'locale', 'layout'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)

        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'mobile-access: dictionaries')

        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.plugin = 'dsh-plugin-mobile-access'
          style.textContent = CSS
          document.head.append(style)
          syncDocument(loadPrefs())
          return () => { style.remove() }
        }, 'mobile-access: styles')

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'mobile-access',
          order: 60,
          label: () => t('nav'),
          locale: NS,
          inject: () => ({
            prefs: loadPrefs(),
            savePrefs,
            requestLogin,
            requestNetworks,
          }),
        }, Section))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'mobile-access',
          locale: NS,
          inject: () => ({
            toggleSidebar: () => { ctx.layout.toggleSidebar() },
          }),
        }, FloatingMenu))
      },
    }
  },
})
