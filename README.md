# 🍅 番茄钟 · Pomodoro Desktop

一款**温馨治愈风格**的番茄钟桌面应用。暖色随阶段流转，小番茄陪你专注。开源、免费、数据全在本地。

基于 Electron + Vite + React 构建，支持 Windows。

> **不想安装？** 在线试用（同一套界面，数据存在你浏览器里）：<https://sandbeta.github.io/pomodoro-desktop/demo/>
> 项目主页：<https://sandbeta.github.io/pomodoro-desktop/>

## ✨ 功能

- **三阶段自动流转**：专注 25 分钟 → 短休息 5 分钟，每完成 4 个番茄进入长休息 15 分钟（时长/节奏均可在设置中自定义）
- **完整计时控制**：开始 / 暂停 / 继续 / 重置 / 跳过 / **标记中断** / 重新开始一轮
- **治愈视觉**：随阶段切换的柔和色温（暖橘 / 鼠尾草绿 / 雾蓝）、呼吸动画、SVG 圆环进度
- **专注统计**：今日 / 本周 / 本月番茄数与专注时长，近 7 天趋势图，以及「你通常倒在第几分钟」的中断画像
- **本地持久化**：历史记录以 JSON 存于本机，不联网、不上传；支持一键导出 JSON/CSV、导入合并与清空
- **数据随你搬**：可把历史文件改存到 Dropbox / iCloud / Syncthing 等任意同步目录，多设备共用同一份，不需要账号也没有后端
- **托盘常驻**：关闭窗口缩到托盘继续计时，阶段结束弹系统通知（均可在设置中开关）
- **合成提示音**：阶段结束提示音由 Web Audio 实时合成，不打包任何音频文件
- **精准计时**：基于结束时间戳的计时引擎，长时间运行无漂移；隐藏到托盘不降频
- **自适应渲染**：默认 GPU 硬件加速（运行态 CPU 占用 <10%），GPU 崩溃后自动降级软件渲染保底

## 📥 下载与使用

到 [Releases](https://github.com/sandbeta/pomodoro-desktop/releases) 下载，或自行构建（见下方「开发」），产物在 `dist/` 目录。

| 下载文件名 | 用法 |
| --- | --- |
| `pomodoro-desktop-portable-x.y.z.exe` | 免安装，双击即用，可放 U 盘随身携带 |
| `pomodoro-desktop-installer-x.y.z.exe` | 常规安装，自动创建桌面 / 开始菜单快捷方式 |

> 下载文件名用 ASCII，是因为 GitHub 的资产上传 API 不接受非 ASCII 文件名（实测会 404）。
> 自行 `npm run dist` 出的本地产物仍是中文名 `番茄钟-便携版-*.exe` / `番茄钟-安装包-*.exe`，
> 应用内名称、开始菜单与桌面快捷方式也始终是「番茄钟」，不受影响。

历史记录默认保存在 `%APPDATA%\pomodoro-desktop\pomodoro-history.json`，卸载重装不丢失。想多台机器共用同一份，可在「设置 → 数据 → 改存到别的目录」里把它指到你的同步文件夹（用 OneDrive 的话记得设为「始终保留在本设备」，否则未下载的文件只是个占位符）。

## 🛠️ 开发

```bash
# 环境要求：开发验证于 Node.js v24 / npm 11（Electron 33）
npm install

# 开发模式（热更新）
npm run dev

# 纯逻辑单元测试（计时 5 组 + 统计 12 组 + 导出与导入 16 组，无需启动应用）
node test-timer.mjs
node test-stats.mjs
node test-export.mjs

# 生产构建（验证编译）
npm run build

# 打包 Windows exe（安装包 + 便携版）
npm run dist
```

> 国内网络建议保留仓库自带的 `.npmrc`（npmmirror 镜像）。若遇 npm 11 下 Electron 二进制「假安装」，参见 [PROJECT-HANDOFF.md](./PROJECT-HANDOFF.md) §6.1 的手动修复方法。

### 架构分层

```
src/
├─ main/            Electron 主进程：窗口、历史记录存储、GPU 策略、IPC
├─ preload/         contextBridge 安全桥（渲染层不直连文件系统）
└─ renderer/        React 前端
   └─ src/
      ├─ core/     ★ 纯逻辑（阶段切换规则 / 统计聚合），无框架依赖，单测覆盖
      ├─ hooks/    计时引擎与统计数据 hook
      ├─ components/圆环进度、统计看板
      └─ utils/    Web Audio 提示音合成
```

所有「阶段怎么切换、什么时候长休息、统计怎么聚合」的规则收敛在 `core/` 纯函数模块，改动必须同步跑单测。

## 📄 License

[MIT](./LICENSE) © shafeifan
