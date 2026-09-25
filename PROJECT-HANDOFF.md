# 番茄钟桌面应用 · 项目交接文档

> 最后更新：2026-09-26　状态：**v0.3.0（M1–M7）打包中；GitHub 远程与 Pages 已上线**
> 项目路径：`E:\pomodoro-desktop`
> 远程仓库：<https://github.com/sandbeta/pomodoro-desktop>（Public）
> 项目主页：<https://sandbeta.github.io/pomodoro-desktop/>　网页试用：<https://sandbeta.github.io/pomodoro-desktop/demo/>
> Git 身份：提交作者名 `shafeifan`（笔名），邮箱 `sandbeta@users.noreply.github.com`（GitHub 账号是 **sandbeta**，靠邮箱关联账号，署名可保留笔名）

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
├─ package.json                   # 脚本：dev / build / preview / dist；electron-builder build 字段
├─ ROADMAP.md                     # 产品路线图（v0.1 已发 / v0.2 已发 / v0.3+ 候选）
├─ electron.vite.config.mjs       # electron-vite 三段式配置(main/preload/renderer)；renderer.server.host 固定 127.0.0.1（见 §6.7）
├─ test-timer.mjs                 # 计时纯逻辑的单元测试 (node test-timer.mjs)
├─ test-stats.mjs                 # 统计纯函数的单元测试 (node test-stats.mjs)
├─ test-export.mjs                # 导出序列化的单元测试 (node test-export.mjs)
├─ build/                         # 应用图标（icon.ico 多尺寸 BMP / icon.png 供托盘用）
├─ docs/                          # GitHub Pages 站点（源 = master 分支 /docs 目录）
│  ├─ index.html                  # 项目主页/落地页，自包含无构建
│  ├─ assets/                     # 落地页用的应用截图（420×640 真机比例）
│  └─ demo/                       # 网页试用版 = out/renderer 产物 + electronAPI 桩（见 §6.10）
└─ src/
   ├─ main/index.js               # 主进程：窗口、单实例锁、托盘、通知、设置/历史/导出 IPC、GPU 自适应策略
   ├─ preload/index.js            # contextBridge：records(list/append/replace/clear/where) + data(openJson/pickDir) + settings(get/set) + notify + exportSave
   └─ renderer/                   # React 前端
      ├─ index.html
      └─ src/
         ├─ main.jsx              # React 挂载入口
         ├─ App.jsx               # 三视图容器（timer 常挂载隐藏切换，防丢倒计时；ready 门控）
         ├─ index.css             # 设计 tokens + 全部视觉样式 + 动画（含统计/设置/确认弹层）
         ├─ core/timer.js         # ★纯决策逻辑（阶段切换/长休息判定），无 React 依赖
         ├─ core/stats.js         # ★纯统计逻辑（日/周/月聚合、7 天分桶、时长格式化）
         ├─ core/export.js        # ★纯导入导出（toJson/toCsv 转义 · fromExport 解析 · mergeRecords 跨设备合并去重 · defaultName）
         ├─ hooks/usePomodoro.js  # 计时引擎 hook（settings 由外部驱动，记录阶段 startedAt）
         ├─ hooks/useStats.js     # 统计数据 hook（经 IPC 拉取/追加记录并聚合）
         ├─ hooks/useSettings.js  # 设置 hook（主进程加载/保存，ready 标志）
         ├─ utils/sound.js        # Web Audio 提示音合成
         ├─ components/TimerView.jsx     # 计时主界面（右上 📊/️ 双入口）
         ├─ components/ProgressRing.jsx  # SVG 圆环进度组件
         ├─ components/StatsPanel.jsx    # 统计看板（chart.js 柱状图 + 汇总卡片）
         ├─ components/SettingsPanel.jsx # 设置面板（时长/行为开关/数据导出清空）
         └─ components/Confirm.jsx       # 二次确认弹层（清空数据用）
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

### ✅ M5（v0.2）— 托盘 / 通知 / 设置 / 数据导出
- **设置体系**：`DEFAULT_SETTINGS` 不再硬编码，`hooks/useSettings.js` 启动时从主进程拉取（ready 门控），`SettingsPanel.jsx` 修改后 `settings:set` 落库（主进程白名单 + 数值 clamp 校验）。时长/longEvery/autoStart/sound/notify/minimizeToTray 全可配。
- **计时视图**：抽成 `TimerView.jsx`，App 里**常挂载 + CSS 隐藏**切换三视图（timer/stats/settings），切去设置不会丢倒计时；且必须 ready 后才挂载，否则 usePomodoro 用默认时长初始化（实测踩过的坑）。
- **托盘**：`Tray` + 右键菜单（显隐/退出），左键切显隐；`win.on('close')` 按 `minimizeToTray` 决定隐藏进托盘还是真退出（`isQuitting` 门控）；首次进托盘弹 balloon 提示。托盘图标用 `build/icon.png`（`nativeImage.createFromBuffer` 不认 asar 路径、不解析 ICO 流，PNG 最稳）。
- **单实例锁**：`requestSingleInstanceLock` + `second-instance` 唤回窗口——托盘隐藏时再双击 exe 不会开出第二个实例（实测通过）。
- **系统通知**：阶段结束走 `notify:send` IPC → 主进程 `Notification`，**窗口可见且聚焦时自动抑制**（前台不打扰），点击通知唤回窗口；`backgroundThrottling:false` 保证隐藏计时不被降频。
- **数据导出/清空**：`core/export.js` 纯函数（toJson/toCsv 含 RFC 转义/defaultName）+ 5 组单测；落盘走 `dialog.showSaveDialog`（**必须先 `showWindow()` 再弹**，父窗口隐藏时对话框会挂起——实测踩过的坑）；清空走应用内二次确认弹层。
- 实测：设置持久化跨重启生效（180:00 表盘）、1 分钟真实番茄走完自动落库+通知、关窗进托盘进程存活、二次启动唤回窗口、设置页/主界面渲染截图确认。
- **v0.2.0 产物**：`dist\番茄钟-便携版-0.2.0.exe` / `番茄钟-安装包-0.2.0.exe`。

### ✅ M6（部分）— 打包出可双击的 exe
- `package.json` 已补 electron-builder `build` 字段：appId `dev.shafeifan.pomodoro`、productName `番茄钟`、win 双目标（nsis + portable，均 x64）、图标 `build/icon.ico`、产物中文名。
- 应用图标：程序化绘制的暖橘番茄（16/32/48/256 多尺寸 BMP 编码 ICO，见 §6.9 为何不能用 PNG-in-ICO），窗口标题栏与 exe 图标都有了。
- 主进程加 `app.setName('pomodoro-desktop')`，让**开发版 / 安装包 / 便携版共用同一份** `Roaming\pomodoro-desktop\pomodoro-history.json` 历史记录。
- `npm run dist` 产出（当前 v0.2.0）：`dist\番茄钟-便携版-0.2.0.exe`（双击即用，约 78MB）、`dist\番茄钟-安装包-0.2.0.exe`（NSIS，可选安装目录+桌面快捷方式）。
- 便携版已实测：双击 → 窗口正常弹出、界面渲染、标题栏番茄图标正确。
- **未完成**：GitHub Actions 自动发布（见 §7 / ROADMAP #13）。远程仓库与 Pages 已于 2026-09-25 建好。

### ✅ M7（v0.3）— 中断记录 / 数据可迁移 / 网页试用

- **中断成为一种被记录的结果**。此前 `skip()` / `reset()` 根本不写记录，schema 里的 `completed` 字段**恒为 true**，统计层那句「只计 completed 的 focus」是在过滤一个不可能出现的值 —— 最有信息量的数据被整个扔掉了。现在计时视图新增「标记中断」按钮（仅在真的起步后出现），落一条 `completed:false` + `elapsedSec` 的记录再进入下一阶段。
  - **`durationSec` 语义保持不变**（仍是该阶段的「计划时长」），实际坚持时长另存 `elapsedSec`。这样 `summarize` / `dailyFocusBuckets` 一行都不用改就能正确排除中断。
  - `core/stats.js` 新增 `interruptStats(records, days)`：完成/中断分别计数、中断占比、平均坚持秒数、以及**「多数倒在第几分钟」**（并列取更早的那个，因为更早中断更值得提醒）。StatsPanel 底部渲染成一块不评判的提示。
  - 中断**不弹**「完成」通知：`App.jsx` 的 `handlePhaseComplete` 现在按 `info.completed` 分流。
  - 空状态文案由「还没有专注记录」改成「还没有走完的番茄」—— 有了中断记录之后，前者会变成假话。
- **数据可迁移**。新增 `dataDir` 设置（默认空 = userData）与导入能力。用户把历史文件指到自己的同步目录即可获得多设备共用，**无账号、无后端、不存凭据**，且完全符合 ROADMAP 的「不做云账号体系」。
  - 解析与合并放在 `core/export.js`（纯函数、可单测）：`fromExport()` 接受 `{app,version,records}` 包装或裸数组，坏输入返回错误不抛异常；`mergeRecords()` 取并集升序、上限 2 万条。
  - **合并身份用 `startedAt|mode|durationSec`，故意不含 `id`** —— id 落库时取 `Date.now()`，两台设备同一毫秒开始一个番茄会撞号，用 id 去重会静默丢掉另一台机器的记录。
  - 导出格式升到 `version: 2`（CSV 多一列 `elapsed_sec`），**导入同时兼容 v1**。文件一旦交给用户保管就是公开契约，改一次断一次。
  - 主进程 `cleanRecord()` 与 `core/export.js` 的 `normalizeRecord()` **有意重复**：那是边界校验，不是复用点。顺带把 `records:append` 从 `{...rec}` 展开改成逐字段白名单，渲染层不能再往记录里塞任意键。
  - 换目录流程由渲染层编排：读旧目录 → `settings:set({dataDir})`（主进程重建 Store）→ 读新目录 → `mergeRecords` → `records:replace`。这样任何一边的历史都不会被「切」没。
  - `createHistoryStore()` 外面包了 try/catch：自定义目录可能不可写、已删除、或是 OneDrive 的按需占位符 —— 打不开就退回默认目录，绝不让应用起不来。
- **网页版在线试用 + 项目主页**。`docs/index.html` 是落地页，`docs/demo/` 是可直接使用的网页版。
- **修掉两个缺陷**：① `.view-host` 在 CSS 里**完全没有规则**（只有 `.view-hidden`），断掉 `#root → .stage` 的 `height:100%` 链，实测视口 1144px 时 stage 只有 554px。专注态因窗口底色 `#FFF6EE` 与 `#fff1e8` 接近而看不出来，**休息阶段换色后窗口底部会露出一条不匹配的横带** —— 这是 M5 加包装层时引入的回归，M3 验收时还没有这层。② 休息阶段主按钮仍写「开始专注」，现按阶段显示「开始专注 / 开始休息」。
- **单测从 17 组增至 33 组**（计时 5 + 统计 12 + 导入导出 16），并补了 `npm test` 脚本 —— 此前「改 core 必须同步跑单测」这条铁律只靠人肉记着。

---

## 5. 如何运行

```bash
cd pomodoro-desktop

# 开发（热更新）——注意：宿主终端注入的环境变量会卡死页面，见 §6.8，先清再启动
env -u CHROME_CRASHPAD_PIPE_NAME -u ELECTRON_FORCE_RENDERER_ACCESSIBILITY npm run dev

# 生产构建（验证编译，产物在 out/）
npm run build

# 跑逻辑单测（计时 5 组 + 统计 12 组 + 导入导出 16 组 = 33 组）
npm test

# 打 Windows 双产物（安装包 + 便携版，需网络走镜像，见 §6.1/§6.9）
# 前置：electron-builder 必须 ≥26（25.x 的 rcedit 缺陷见 §6.9）
$env:ELECTRON_MIRROR='https://registry.npmmirror.com/-/binary/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://registry.npmmirror.com/-/binary/electron-builder-binaries/'
npm run dist
# 产物：dist\番茄钟-便携版-<ver>.exe（双击即用）/ dist\番茄钟-安装包-<ver>.exe
```

依赖通过 `.npmrc` 走 npmmirror。Node 版本已验证 v24.16.0。

**日常使用（不开发）**：到 Releases 页下载，或直接双击 `dist\番茄钟-便携版-<版本>.exe`，无需 Node 环境；首次启动需等几秒（portable 自解压）。也可以跑一次安装包，之后从桌面/开始菜单的「番茄钟」快捷方式启动。

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

10. **在浏览器里跑渲染层（预览 / 截图 / 网页版）的正解**
    `out/renderer` 本身就是个 React SPA，缺的只有 `window.electronAPI`。所以**不需要为网页版单独构建**：把 `out/renderer/` 拷出去，在 `<head>` 里那个 `<script type="module">` **之前**插一段普通 `<script>` 注入 electronAPI 桩即可（classic script 同步先跑，module 是 deferred，顺序天然正确）。
    两个坑：① 桩的校验规则要和 `src/main/index.js` 对齐，否则网页版比桌面版宽松，用户在两边会得到不同结果。② 想改页面尺寸时，应用自己的 `html, body, #root { height: 100% }` 会盖住你注入的 `<style>`（同特异度、`<link>` 在后面），必须加 `!important`。
    另外：桩**不要暴露 `data.pickDir`**，设置面板会因此自动隐藏「改存到别的目录」按钮 —— 比显示一个点了没反应的死控件好。`data.openJson` 则可以用隐藏 `<input type=file>` 实现，导入在浏览器里是真能用的。

11. **GitHub Release 页的二进制上传控件对自动化不可见（原因已查明；失败归因未查明）**
    收二进制的 input 是 `#releases-upload`，它带 **`aria-hidden="true"` 和 `tabindex="-1"`** —— 这才是它始终不进可访问性树、自动化工具拿不到它的真正原因（**不是** `sr-only` 裁剪，也不是组件重渲染）。工具栏那个 `#fc-release_body` 能拿到，但有扩展名白名单，`.exe` 会被判 "We don't support that file type"。

    **两个容易误读的地方**（我自己都踩过）：
    - Release 页的 DOM 里**预渲染了一整套隐藏的上传错误模板**（"This file is empty" / "This file is hidden" / "Attaching documents requires write permission" / "We don't support that file type" 等）。用 `document.querySelectorAll` 抓 `.flash-error` 会一次捞出十几条，**看着像真报错，其实全部不可见**。判断前必须过一遍可见性（`getBoundingClientRect()` 宽高 > 0 且 `visibility !== hidden`）。同理，表单里那个 `release[release_assets_attributes][][name]` 空值字段也是**静态模板行**，点了移除按钮它依然在，不代表有残留附件。
    - `/releases/tag/<v>` 返回 **200 不能证明 Release 存在** —— tag 存在就返回 200，没有 Release 时页面显示「该 tag 暂无发布说明」。要确认得查 `GET /repos/<owner>/<repo>/releases`，看 `tag_name`。

    **仍未查清**：v0.3.0 那次 Release 创建，前两次 Publish 静默失败、页面上只留一句 "There was an error creating your Release."。我当时连着改了三样（补标题、点移除附件、改用 JS 提交表单），第三次成功，**无法归因到具体哪一项**。此前本文件写的「是 DOM 手术造出坏附件污染了服务端草稿」这个因果解释**没有证据支撑，已作废**。

    结论：二进制走人工拖拽，或用 GitHub Actions（`.github/workflows/release.yml`，已落地）由 CI 构建并上传 —— 后者不依赖猜对前端 DOM，是更可靠的路。

12. **Private 仓库开不了 GitHub Pages**
    免费套餐下 Pages 要求仓库公开，设置页会写「Upgrade or make this repository public to enable Pages」。所以本项目要 Pages 就必须 Public。

13. **git 提交邮箱必须是 GitHub 认的那个**
    作者名可以是笔名（`shafeifan`），但 GitHub 靠**邮箱**关联账号。本机曾长期用 `shafeifan@users.noreply.local` 这种假域名，导致 commit 不亮头像、不计入贡献图。正确值是 `sandbeta@users.noreply.github.com`（账号是 **sandbeta**）。仓库已用 `git config user.email` 固定，历史也已重写修正。

14. **Release 下载文件名必须是 ASCII，本地产物不是**
    GitHub 的资产上传 API（`uploads.github.com/.../assets?name=…`）**不接受非 ASCII 文件名**：用 `gh release upload` 直接传 `番茄钟-便携版-0.3.0.exe` 会拿到 `HTTP 404`；而 softprops/action-gh-release 会先把名字按 URL 安全字符清洗 —— 两个中文名清洗后**塌缩成同一个 `-.-0.3.0.exe`**，互相覆盖只剩一个乱名资产，它随后去 PATCH 恢复原名时目标已不存在，报 404。
    所以 `.github/workflows/release.yml` 在上传前把产物改名成 `pomodoro-desktop-portable-<ver>.exe` / `pomodoro-desktop-installer-<ver>.exe`，并在上传后做一次幂等清理（删掉不在预期列表里、也不是源码包的资产）。**网页 UI 拖拽走的是另一条路径，中文文件名反而没问题** —— 别用这个反例推翻上面的结论。
    改名只发生在 CI 上传环节：`package.json` 的 `artifactName` 保持中文，本地 `npm run dist` 产物、应用内名称、开始菜单与桌面快捷方式都仍是「番茄钟」。

---

## 7. 待办里程碑

### ✅ M6 — 开源仓库收尾（2026-09-25 完成）
- GitHub 远程已建：`sandbeta/pomodoro-desktop`（Public），master + `v0.2.0` tag 已推送。
- GitHub Pages 已上线（源 = `master` /docs）：项目主页 + 网页试用版，README 截图待补一项由落地页承担。
- **仍待办**：Actions 自动发布（ROADMAP #13）—— 目前 82MB 的 exe 只能人工拖进 Release（见 §6.11）。

### ✅ M7（v0.3）— 中断记录 / 数据可迁移 / 网页试用
见 §4 M7。ROADMAP 剩余候选：累积型专注花园、治愈白噪音、周报分享图、全局快捷键。

---

## 8. 当前验证状态（事实 vs 判断）

**已确认（事实）**：`npm test` 全绿（计时 5 + 统计 12 + 导入导出 16 = 33 组）；`npm run build` 全绿；M4/M5 端到端实测通过（完成落库、设置持久化跨重启生效、托盘关窗存活、单实例唤回、前台通知抑制、1 分钟真实番茄走完自动落库+通知、设置页与主界面截图渲染确认）；M3 界面已由需求方验收通过（2026-09-24）；**v0.2.0 打包实测通过**（便携版双击启动、双图标、exe 与标题栏番茄图标正确）。

M7 补充实测：Electron 主进程真实启动（`did-finish-load` 触发、窗口可见、未崩在 `createHistoryStore()`），确认 `%APPDATA%` 既有历史未丢、settings 新增 `dataDir` 键；网页版端到端验证（起步 → 「标记中断」出现 → 落库 `{completed:false, elapsedSec, durationSec:1500}` → 阶段切短休息 → 不弹完成通知 → 统计显示「倒在第 N 分钟」且中断不计入番茄数）；`records:replace` 对非法 mode/类型逐条拒绝；导入件 `elapsedSec:1200` 正确显示为第 20 分钟；`.view-host` 修复后用 `elementFromPoint` 抽查视口最底行三点，全部命中 `.stage mode-short`（修复前会命中 body）。

**待确认（不确定项）**：① 导出保存对话框与**导入文件选择框**的「选路径→确认」人工交互（自动化环境无法可靠操作原生模态框；IPC 链路、取消路径、解析与合并逻辑均已用注入方式验证）；② 托盘图标的目视确认（Win11 隐藏托盘区无法截图）；③ 设置页/统计页视觉观感细节待需求方验收；④ **「改存到别的目录」在真机上的完整往返尚未实测** —— 网页版故意不暴露该按钮，只有桌面版有，需要人工点一遍并验证两边记录被正确合并；⑤ v0.3.0 安装包/便携版尚未产出与实测（本次改动含主进程，须重新 `npm run dist` 后双击验一遍）。

---

## 9. 恢复工作的建议顺序

1. 先清宿主注入的环境变量（§6.8 三条 unset）再跑 `npm run dev`；若报 `Electron uninstall`，照 §6.1 补二进制；若白屏/窗口不出现，对照 §6.7/§6.8 判别；若打包 rcedit 报错，对照 §6.9。
2. 请需求方人工点一遍 v0.2：设置改时长→导出 JSON/CSV→关窗进托盘→等通知，反馈后微调。
3. 然后按 ROADMAP 进 M7（v0.3 候选功能），或先推 GitHub 远程补 M6 剩余。
