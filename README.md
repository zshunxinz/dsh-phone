# dsh-phone

DSH 手机端访问插件（包名 `dsh-plugin-mobile-access`）：令牌解锁页 + 可吸附边缘把手 + 响应式设置面板，不改 DSH 源码，Windows / Linux 通用。

给已经“添加到主屏幕”的 DSH（`dsh web`）用的移动端插件。它做三件事：

1. **让令牌变成可以输入的参数**。安装后的手机应用从 `/unlock` 启动，输入一次访问令牌即可登录；之后由 `HttpOnly` Cookie 记住登录状态。
2. **手机宽度下完全收起侧边栏**。侧边栏从 56px 图标导轨变成 0 宽，对话占满屏幕；左边缘把手以覆盖式抽屉打开菜单。
3. **版本与更新**。设置页检查 DSH 运行时与插件自身的新版本；插件可一键下载并应用更新（Host 半边需重载行或重启）。

不改动 DSH 源码，Windows 与 Linux 上的 `dsh web` 通用；安装目录可整体复制到另一台机器。

## 安装

任选一种（需要 Host 能调用 `pnpm`）：

- **Web 界面**：侧边栏 → **Plugins** → **Add plugin** → 填入插件目录的绝对路径，例如
  `/path/to/dsh-mobile-access`（Windows 如 `D:\plugins\dsh-mobile-access`）。
- **命令行**：`dsh plugin --profile web add /path/to/dsh-mobile-access`
  （Windows 用对应的绝对路径）。

安装会加一条 Loader 行 `dsh-plugin-mobile-access:mobile-access`，并把 bundle 加进 profile 的 `dsh.profile.bundles`。Web 组合带 HMR，保存后立即生效；否则重启 `dsh web`。

### Windows：profile 与插件不在同一个盘时

pnpm 在 profile 工作区里会把 `link:E:/…` 当成相对路径，生成指向
`…\profiles\web\E:\…` 的失效链接。稳妥做法是把插件目录放到 profile 同盘，并用相对路径依赖：

```powershell
$plugins = "$env:USERPROFILE\.dsh\plugins"
New-Item -ItemType Directory "$plugins\dsh-mobile-access" -Force | Out-Null
Copy-Item "D:\plugins\dsh-mobile-access\*" "$plugins\dsh-mobile-access" -Recurse -Force
# profile/package.json 的 dependencies 写成：
#   "dsh-plugin-mobile-access": "link:../../plugins/dsh-mobile-access"
# 然后在该 profile 目录执行 pnpm install，并把名字加入 dsh.profile.bundles
```

更新源码后重新执行上面的 `Copy-Item` 即可（`client.js` 会被客户端 HMR 自动热替换，Host 半边需要重载行或重启）。

卸载：在 Plugins 页移除该 bundle，或 `dsh plugin --profile web remove dsh-plugin-mobile-access`。

## 手机端流程（Android）

1. 电脑端打开 **Settings → 移动端访问**，填入手机能访问的地址（点“检测局域网地址”可直接选）。
   - 如果 `dsh web` 只监听 `127.0.0.1`，手机访问不到：用 `dsh web --host <电脑局域网IP>` 重启，或使用反向代理。
2. 在手机浏览器打开页面上显示的 **解锁页地址**（`<地址>/unlock`）。
3. 输入访问令牌：
   - 令牌在启动 `dsh web` 的终端里，形如 `http://…/?token=…`，复制 `token=` 之后的部分；
   - 也可以在电脑端设置页点“生成登录链接”，复制令牌或直接用一键登录链接。
4. 登录成功后，用浏览器菜单 **→ 添加到主屏幕**。

> 重要：请从**解锁页**添加到主屏幕，不要从应用首页添加。首页图标会直接打开应用，签名丢失时会停在未授权页面；解锁页图标每次启动都会先经过解锁页，已登录时自动进入。

之后从主屏幕启动：先到解锁页（一闪而过），已登录直接进应用；Cookie 失效时重新输入令牌即可。默认 Cookie 有效期 30 天。

## 侧边栏与响应式布局

设置页里的开关默认开启，仅对当前浏览器生效，可随时关闭。**没有断点选项**：跟随布局自身的窄屏判定（≤1023px）自动生效。

- **窄屏完全收起侧边栏**：侧边栏处于收起状态时，左侧轨道宽度为 0，不再保留 56px 导轨；抽屉宽度沿用侧边栏自身宽度，随窗口自适应。
- **可吸附的边缘把手**：收起时贴在边缘的小标签；按住拖动时变成圆形圆球、跟随手指移动，松手后自动吸附到更近的一侧边缘（左或右），纵向位置按比例记住；轻点打开侧边栏。不占用任何横向宽度；拖动、吸附、抽屉滑入、遮罩淡入都有过渡，并遵循系统的“减少动态效果”设置。
- **设置面板**：窄屏下变成单栏——顶部标题、分区列表变成会自动换行的胶囊条（全部可见，不横向滚动）、内容占满宽度、右上角浮动操作按钮；宽屏保持原来的左右两栏。
- 桌面宽度、以及关闭开关时，行为与原生完全一致。

实现方式：插件注入一段样式，只用 DSH 自带的稳定标记（`data-sidebar-collapsed`、`data-shell-overlay`、`data-side`，设置面板用 `data-shortcut-modal="settings"` 加自身结构），不依赖 CSS Modules 的哈希类名，也不修改任何源码。所以同一份 `client.js` 在 Windows / Linux、不同 DSH 版本里都能用；若将来 DSH 改动这些标记，功能会退化为原生布局，不会把界面弄坏。

## 打包与分发

构建产物在仓库的 `dist/`：

- `dsh-plugin-mobile-access-1.1.0.tgz`：npm 包 tarball，推荐用它安装：
  `dsh plugin --profile web add /path/to/dsh-plugin-mobile-access-1.1.0.tgz`
  （Web 界面的 **Add plugin** 也接受这个文件路径）
- `dsh-plugin-mobile-access-1.1.0.zip`：整包源码，适合“复制到目标机器再安装”的跨盘场景（见上面的 Windows 说明）。
- `SHA256SUMS.txt`：两个包的 SHA-256。

重新打包：在仓库根目录执行 `pnpm pack --pack-destination ./dist`；tarball 解包后可直接运行
`node package/tests/smoke.mjs` 自检（无外部依赖）。

## 版本与更新

设置页的「版本与更新」会显示 **DSH 运行时** 和 **本插件** 的当前 / 最新版本（DSH 取 npm registry 的 `@deepseek-ai/dsh`，插件取 GitHub Release）。

- **更新插件**：从 GitHub 最新 Release 下载 `.tgz`，校验包名后原子替换自身文件（先备份，失败自动还原）。`client.js` 会被客户端 HMR 自动热替换；`index.js` 属于 Host 半边，需要**重载插件行或重启 `dsh web`** 才生效。
- **更新 DSH**：DSH 是正在运行的服务，插件不能安全地替换并重启它。检查到新版本后会给出启动命令（`npx -y @deepseek-ai/dsh@latest web`），保留你原来的启动参数、停止旧进程后用新版本启动即可。
- 检查结果缓存 10 分钟；界面上的「检查更新」会强制刷新。

## 路由

| 路由 | 鉴权 | 用途 |
|---|---|---|
| `GET /unlock` | 无 | 独立的解锁页（令牌输入） |
| `GET /manifest.webmanifest` | 无 | 在原始 manifest 上把 `start_url` 指向 `./unlock`，保留 `id: "./"` 让 WebAPK 原地升级 |
| `GET /mobile-access/login-url` | 需要已登录 | 返回当前进程令牌拼好的登录地址 |
| `GET /mobile-access/networks` | 需要已登录 | 本机局域网 IPv4 候选地址 |

令牌只在同源页面之间传递给已认证的调用方，不写入 localStorage，也不出现在 `/unlock` 的 HTML 里。

## 故障排查

- **手机打开显示 403 / “未被服务器信任”**：`dsh web` 的 `trustedHosts` 没包含手机使用的主机名。把该主机（或 `host:port`）加入 `client-connection` 的 `trustedHosts` 后重启。
- **手机打不开页面**：确认 `dsh web --host` 绑定的是电脑的局域网地址（不是 `127.0.0.1`），且防火墙放行端口。
- **安装时提示 `not-a-bundle`**：路径要指向本目录（含 `package.json`），不是 `index.js`。
- **设置页没有“移动端访问”**：确认浏览器的 DSH 页面已重新加载，且插件行处于运行状态（Plugins → 本插件）。
- **更新插件后行为异常**：链接目录是原地读取的，重写 `client.js` 会自动热更新；Host 半边（`index.js`、`cordis.patch.yml`、`package.json`）改动需要重载该行或重启。
- **Android 上无法“安装应用”而只有“添加到主屏幕”**：普通 HTTP 局域网地址不是安全上下文，浏览器不提供真正的 PWA 安装，快捷方式即可满足本插件的用法。

## 已知限制

- 桌面与手机共享 `/manifest.webmanifest`：桌面浏览器若使用“安装应用”，启动目标也会变成 `/unlock`（已登录时会自动跳转，无感知）。
- iOS 的独立 Web App 与 Safari 的 Cookie 存储不共享；本插件同样适用于 iOS，只是 iOS 只在“添加到主屏幕”时读取一次 `start_url`，升级插件后需要删除旧图标重新添加。
- 侧边栏适配依赖 DSH 的 DOM 标记，DSH 大版本升级后可能需要更新选择器。


