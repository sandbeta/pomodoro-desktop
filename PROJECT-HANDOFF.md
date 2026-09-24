# 番茄钟桌面应用 · 项目交接文档

> 最后更新：2026-09-24　状态：**M1–M4 + M6 打包完成，M5 与 README 待做**
> 项目路径：`pomodoro-desktop/`（已整体迁移至 **E:\pomodoro-desktop**）

---

## 1. 这是个什么项目

一款**温馨治愈风格的番茄钟桌面应用**，定位是开源发布、功能完整带统计。

核心决策（已与需求方确认，勿擅自推翻）：

| 维度 | 结论 |
| --- | --- |
| 产品形态 | 桌面 App |
| 用途目标 | 开源 / 发布给他人 |
| 功能范围 | 完整版，含专注统计 |
| 视觉风格 | 温馨治愈（暖色调、圆润、陪伴感） |
| 技术栈 | Electron + Vite + React |

---

## 2. 技术选型与理由

- **Electron（而非 Tauri）**：本机已具备 Node v24 / npm 11 / Git，Electron 可零额外安装直接跑；Tauri 需要先装 Rust + MSVC 工具链，会拖慢起步。**已知代价**：安装包偏大（80–100MB）、内存占用偏高。若日后要瘦身，Tauri 是可选的迁移方向，但不该挡住当前进度。
- **React + Vite**：需求方在「原生 JS」与「React」之间选了 React，理由是统计看板（M4）多页面/复杂状态更适合组件化。
- **提示音用 Web Audio API 现场合成**：不打包任何音频文件，开源仓库更干净，也规避版权。**这是刻意的架构选择，别改成引用 mp3。**
- **动效纯 CSS**：未引入 framer-motion 等动画库，保持依赖轻量。呼吸/淡入/圆环过渡均用 CSS 实现。

---

## 3. 目录结构

```
pomodoro-desktop/
├─ .npmrc                         # 指向 npmmirror，含 electron 镜像配置（注意见 §6 的坑）
├─ package.json                   # 脚本：dev / build / preview / dist
├─ electron.vite.config.mjs       # electron-vite 三段式配置(main/preload/renderer)；renderer.server.host 固定 127.0.0.1（见 §6.7）
├─ test-timer.mjs                 # 计时纯逻辑的单元测试 (node test-timer.mjs)
├─ test-stats.mjs                 # 统计纯函数的单元测试 (node test-stats.mjs)
└─ src/
   ├─ main/index.js               # Electron 主进程：建窗口、开发/生产加载、electron-store 历史库 + IPC(records:list/append)
   ├─ preload/index.js            # contextBridge 暴露 electronAPI（records.list/append 已接 IPC，M5 继续扩展）
   └─ renderer/                   # React 前端
      ├─ index.html
      └─ src/
         ├─ main.jsx              # React 挂载入口
         ├─ App.jsx               # 主界面（timer/stats 双视图切换，接 onPhaseComplete 落库）
         ├─ index.css             # 设计 tokens + 全部视觉样式 + 动画（含统计看板样式）
         ├─ core/timer.js         # ★纯决策逻辑（阶段切换/长休息判定），无 React 依赖
         ├─ core/stats.js         # ★纯统计逻辑（日/周/月聚合、7 天分桶、时长格式化）
         ├─ hooks/usePomodoro.js  # 计时引擎 hook（引用 core/timer + sound，记录阶段 startedAt）
         ├─ hooks/useStats.js     # 统计数据 hook（经 IPC 拉取/追加记录并聚合）
         ├─ utils/sound.js        # Web Audio 提示音合成
         ├─ components/ProgressRing.jsx  # SVG 圆环进度组件
         └─ components/StatsPanel.jsx    # 统计看板（chart.js 柱状图 + 汇总卡片）
```

**分层原则（重要）**：所有「阶段该怎么切、什么时候长休息」的规则都收敛在 `core/timer.js` 这一个纯函数模块里，`usePomodoro.js` 和 `test-timer.mjs` 都依赖它。改切换逻辑只动这一处，且必须同步跑单测。

---

## 4. 已完成里程碑

### ✅ M1 — 脚手架跑通
electron-vite 三段结构搭好，`npm run dev` 能弹出窗口、React 交互正常。

### ✅ M2 — 核心计时引擎
- 工作 / 短休息 / 长休息 自动切换；默认 25 / 5 / 15 分钟，每完成 4 个番茄进一次长休息。
- 控制项：开始 / 暂停 / 继续 / 重置（当前阶段）/ 跳过（不计完成）/ 重新开始一轮（归零计数）。
- **计时用「结束时间戳」而非累加式 setInterval**，避免长时间运行的计时漂移。
- 阶段自然走完时触发提示音 + `onPhaseComplete` 回调（M4 写历史就接这个回调，已预留）。
- 切换规则有单元测试覆盖，5 组断言全过。

### ✅ M3 — 温馨治愈 UI
- 随阶段切换的柔和色温：专注=暖橘 `#fff1e8` / 短休=鼠尾草绿 `#eef6ec` / 长休=雾蓝 `#eaf1f7`。
- 中央 SVG 圆环进度 + 大号细字倒计时；顶部小角色 🍅/🍵/🌿，运行时「呼吸」动画、暂停即静止。
- 底部番茄完成计数用小番茄🍅逐个点亮；柔和光晕、胶囊按钮、阶段切换淡入。

### ✅ M4 — 统计与本地存储
- 依赖：`electron-store@11`（主进程 JSON 持久化）+ `chart.js@4` + `react-chartjs-2@5`。
- 数据流：`usePomodoro` 的 `onPhaseComplete` 回调携带 `{mode, startedAt, at, durationSec, completed}` → App 层经 `electronAPI.records.append`（IPC invoke）→ 主进程 electron-store 落盘（`userData/pomodoro-history.json`，上限 2 万条）。跳过/重置不产生记录；主进程侧对写入做最低限度校验（mode 白名单 + 数值类型），非法数据拒收。
- 统计：`core/stats.js` 纯函数（日/周/月聚合、近 7 天分桶、跨月边界）+ 7 组单测；`StatsPanel.jsx` 双视图（主界面右上「📊 统计」进入，返回时刷新），三张汇总卡片 + 每日专注分钟柱状图，空数据有🌱空状态。
- 持久化验证过：重启应用后记录完整恢复（实测 60 秒专注走完 → 落库 durationSec=60、gapSec=60，重启后仍在）。
- **实现时踩到并已修的两个缺陷**（回归时留意别改回去）：① `registerIpc()` 定义后忘调用 → records:list 报 No handler；② 阶段 `startedAt`/`totalRef` 初始化缺失导致落库 durationSec=0 → 现在 `totalRef` 用 `durationFor(FOCUS, settings)` 初始化、start/toggle 时补记 `startedAtRef`。

### ✅ M6（部分）— 打包出可双击的 exe
- `package.json` 已补 electron-builder `build` 字段：appId `dev.shafeifan.pomodoro`、productName `番茄钟`、win 双目标（nsis + portable，均 x64）、图标 `build/icon.ico`、产物中文名。
- 应用图标：程序化绘制的暖橘番茄（16/32/48/256 多尺寸 BMP 编码 ICO，见 §6.9 为何不能用 PNG-in-ICO），窗口标题栏与 exe 图标都有了。
- 主进程加 `app.setName('pomodoro-desktop')`，让**开发版 / 安装包 / 便携版共用同一份** `Roaming\pomodoro-desktop\pomodoro-history.json` 历史记录。
- `npm run dist` 产出：`dist\番茄钟-便携版-0.1.0.exe`（双击即用，78.5MB）、`dist\番茄钟-安装包-0.1.0.exe`（NSIS，可选安装目录+桌面快捷方式，78.7MB）。
- 便携版已实测：双击 → 窗口正常弹出、界面渲染、标题栏番茄图标正确。
- **未完成**：README、LICENSE 文件内容、GitHub 仓库初始化（见 §7）。

---

## 5. 如何运行

```bash
cd pomodoro-desktop

# 开发（热更新）——注意：宿主终端注入的环境变量会卡死页面，见 §6.8，先清再启动
env -u CHROME_CRASHPAD_PIPE_NAME -u ELECTRON_FORCE_RENDERER_ACCESSIBILITY npm run dev

# 生产构建（验证编译，产物在 out/）
npm run build

# 跑逻辑单测（计时 5 组 + 统计 7 组）
node test-timer.mjs
node test-stats.mjs

# 打 Windows 双产物（安装包 + 便携版，需网络走镜像，见 §6.1/§6.9）
# 前置：electron-builder 必须 ≥26（25.x 的 rcedit 缺陷见 §6.9）
$env:ELECTRON_MIRROR='https://registry.npmmirror.com/-/binary/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://registry.npmmirror.com/-/binary/electron-builder-binaries/'
npm run dist
# 产物：dist\番茄钟-便携版-<ver>.exe（双击即用）/ dist\番茄钟-安装包-<ver>.exe
```

依赖通过 `.npmrc` 走 npmmirror。Node 版本已验证 v24.16.0。

**日常使用（不开发）**：直接双击 `E:\pomodoro-desktop\dist\番茄钟-便携版-0.1.0.exe` 即可，无需 Node 环境；首次启动需等几秒（portable 自解压）。也可以跑一次安装包，之后从桌面/开始菜单的「番茄钟」快捷方式启动。

---

## 6. 关键坑与解决方案 ⚠️（务必读）

1. **Electron 二进制「假安装」——最大的坑**
   现象：`npm install` 显示成功，但 `npm run dev` 报 `Error: Electron uninstall`，窗口弹不出来。
   根因：**npm 11 不再把 `.npmrc` 里的 `electron_mirror` 当有效配置传给 `@electron/get` 下载脚本**（会 warn「Unknown project config」并静默回退到 GitHub），而本机 GitHub 直连不稳，导致 Electron 二进制根本没下载，`node_modules/electron/dist/` 几乎是空的、`path.txt` 缺失。
   解决：手动从 npmmirror 拉 zip 解压。以后任何重装/新克隆都要警惕这个：
   ```bash
   cd node_modules/electron
   curl -fL --retry 3 -o electron.zip \
     "https://registry.npmmirror.com/-/binary/electron/33.4.11/electron-v33.4.11-win32-x64.zip"
   rm -rf dist && unzip -q electron.zip -d dist && echo -n "electron.exe" > path.txt
   ```
   （`<ver>` 与文件名要匹配 `node_modules/electron/package.json` 里的实际版本，当前是 33.4.11。）

2. **Vite build 通过 ≠ 运行时正常**：构建只校验 import/export，不校验运行时标识符。改完代码除了 `npm run build`，仍需在窗口里实际操作确认。

3. **Windows 下 git / 文件锁**：dev server 常驻会锁 `node_modules`，做 git 操作前先 `taskkill //F //IM node.exe`（QoderWork 的 Bash 实为 git-bash，命令用双斜杠转义）。

4. **workspace 目录里 Write 建的文件 Bash 可见**（共享真实文件系统，`npm install` 能正常读到）——这点和 skills 挂载目录的视图隔离不同。

5. **`ELECTRON_RUN_AS_NODE=1` 陷阱（2026-09-24 实测踩坑）**
   现象：`npm run dev` 时 Electron 主进程启动即崩，报 `TypeError: Cannot read properties of undefined (reading 'exports') at cjsPreparseModuleExports`，末尾显示 `Node.js v20.18.3`。
   根因：宿主是 Electron 应用（如 WorkBuddy）的终端会给子 shell 注入 `ELECTRON_RUN_AS_NODE=1`，导致 `electron.exe` 以**纯 Node 模式**运行（此时它就是内嵌的 Node 20.18.3，`electron.exe --version` 会打印 `v20.18.3` 而不是 `v33.4.11`，这是最快的判别方法）。纯 Node 模式下按 ESM 加载 `out/main/index.js`，import npm 的 electron 壳包就会触发上述崩溃。
   解决：启动前清掉该变量（注意设成空串没用，必须 unset）：
   ```bash
   env -u ELECTRON_RUN_AS_NODE npm run dev
   ```

6. **GPU 渲染策略：软件渲染虽稳但吃满 CPU（2026-09-24 两次实测迭代）**
   背景：本机双显卡（Intel Iris Xe + GTX 1650 Ti），Chromium GPU 子进程偶发 `exit_code=-1073741819`（0xC0000005）崩溃，非项目代码问题。
   旧方案（已废弃）：无条件 `--use-angle=swiftshader` 强制软件渲染。**代价**：软件光栅化呼吸动画 + 80px 高斯模糊光晕，运行态 gpu-process 实测吃满 **1100%+ CPU（约 11 核）**，就是用户反馈"CPU 好高"的根因。
   新方案（当前，main/index.js `setupGpuStrategy`）：**默认硬件加速**；仅当捕获到 `child-process-gone`(type=GPU) 时，在 userData 写一个一次性标记 `gpu-software-once.flag`，让**下一次启动**降级软件渲染，启动即清除标记、之后自动回到硬件模式（崩溃→降级一次→重试硬件）。
   实测对比（运行态、breathe+halo 全开）：软件渲染 gpu-process ≈1100%；硬件加速 gpu-process ≈40%、renderer ≈12%，整机约 0.5 核以内。暂停态两者都是 0%。
   若日后要给用户开关：在 M5 设置面板加「硬件加速」项，直接控制这个标记即可。

7. **Vite dev server 只监听 IPv6，Chromium 按 IPv4 连不上 → 白屏（2026-09-24 实测踩坑）**
   现象：`npm run dev` 启动后窗口存在但永远不可见或纯白，`ready-to-show`/`did-finish-load` 都不触发。
   根因：本机环境下 Vite 默认绑定 `[::1]`（netstat 只见 IPv6 监听），而 Electron 里 Chromium 解析 `localhost` 优先走 `127.0.0.1`，连接被拒后页面永远停在未加载状态。
   解决：`electron.vite.config.mjs` 的 `renderer.server.host` 已固定 `'127.0.0.1'`，别删。

8. **宿主终端注入 `CHROME_CRASHPAD_PIPE_NAME` / `ELECTRON_FORCE_RENDERER_ACCESSIBILITY` → Electron 页面永不加载（2026-09-24 实测踩坑）**
   现象：与坑 7 几乎一样（URL 为空、导航永不完成），**且连加载本地 file:// 的最小空应用都复现**——所以先排除代码再查环境。
   根因：千问/WorkBuddy 等 Electron 宿主的终端会给子进程注入这两个变量，Electron 启动后渲染进程被拖死。
   解决：启动前 unset（与 §6.5 同理，设空串没用）：
   ```bash
   env -u CHROME_CRASHPAD_PIPE_NAME -u ELECTRON_FORCE_RENDERER_ACCESSIBILITY -u ELECTRON_RUN_AS_NODE npm run dev
   ```
   PowerShell 等价：`Remove-Item Env:CHROME_CRASHPAD_PIPE_NAME,Env:ELECTRON_FORCE_RENDERER_ACCESSIBILITY,Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue`
   判别方法：若 `npm run dev` 打出 `start electron app...` 但 `[did-finish-load]` 迟迟不来，先按本条排查。
   （主进程已加渲染进程日志桥与 `did-finish-load`/4 秒兜底 `show()`，白屏时终端会直接可见 `[fallback-show] isVisible=false url=`——url 为空即命中坑 7 或坑 8。）

9. **electron-builder 25.x 内置 rcedit 写 exe 资源必炸 → 升级到 26.x（2026-09-24 实测踩坑）**
   现象：`npm run dist` 在 `updating asar integrity executable resource` 之后，rcedit-x64.exe 报 `Fatal error: Unable to commit changes`，重试 4 次全挂。与图标文件无关（只设版本号也炸），与目标文件无关（新拷的干净 electron.exe 反而能改——因为 electron-builder 会先给 exe 写入 asar integrity 资源，25.x 的旧 rcedit 在此基础上二次提交就失败）。
   解决：`npm i -D electron-builder@latest`（26.15.3 实测正常，且新版对 winCodeSign 的处理也更稳）。别回退 25.x。
   附带坑：electron-builder 25 解 winCodeSign-2.6.0 时，包内两个 macOS `.dylib` 符号链接在 Windows 无符号链接权限下创建失败，导致整个解压判为失败（其实 Windows 签名工具都已解出）。若再遇到：把 `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\<随机数字目录>` 改名为 `winCodeSign-2.6.0` 即可复用。
   （排查备忘：`build/icon.ico` 现用 16/32/48/256 多尺寸 BMP 编码。此前 PNG-in-ICO 版本经手动 rcedit 验证也能写入，故 ICO 编码格式不是上述失败的根因，升级 electron-builder 后两者皆可。）

---

## 7. 待办里程碑

### ⬜ M5 — 托盘 / 通知 / 设置
- 系统托盘常驻、阶段结束发系统 Notification（Electron `Notification` 或走主进程）。
- 设置面板：自定义三档时长、`longEvery`、声音开关、`autoStart`。注意 `DEFAULT_SETTINGS` 目前是硬编码，做设置时要让它变成可由外部 state 驱动 `usePomodoro`。

### ⬜ M6（剩余）— 开源仓库收尾
- README（含截图、功能、开发指南）、LICENSE 文件内容（package.json 已声明 MIT，缺 LICENSE 文件）。
- 若开源：`.gitignore` 应排除 `dist/`；可选配 GitHub Actions 自动 release。
- （安装包/便携版 exe 本身已产出并实测，见 §4 M6。）

---

## 8. 当前验证状态（事实 vs 判断）

**已确认（事实）**：计时单测 5/5 + 统计单测 7/7 通过；`npm run build` 全绿；M4 端到端实测通过（完成落库 durationSec/startedAt 正确、非法数据被主进程拒收、重启后记录恢复、统计页卡片与图表渲染正常、双视图切换正常）；M3 界面已由需求方验收通过（2026-09-24）；**M6 打包实测通过**（便携版双击启动、窗口渲染、exe 与标题栏番茄图标正确、NSIS 安装包构建成功带 blockmap）。

**待确认（不确定项）**：统计看板的**视觉观感**（卡片/图表/空状态在真实窗口里是否协调）尚未由需求方肉眼验收。

---

## 9. 恢复工作的建议顺序

1. 先清宿主注入的环境变量（§6.8 三条 unset）再跑 `npm run dev`；若报 `Electron uninstall`，照 §6.1 补二进制；若白屏/窗口不出现，对照 §6.7/§6.8 判别；若打包 rcedit 报错，对照 §6.9。
2. 请需求方验收 M4 统计看板观感，反馈后微调。
3. 然后进 M5（托盘/通知/设置面板），最后补 M6 剩余（README/LICENSE）。
