# dsh-launcher

[![CI](https://github.com/shaun5297/dsh-launcher/actions/workflows/ci.yml/badge.svg)](https://github.com/shaun5297/dsh-launcher/actions/workflows/ci.yml)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 一键启动器，双形态：

- **CLI 工具**：检测后台是否在运行 → 未运行则自动启动 `dsh web` → 等待就绪 → 在 **Chrome 新窗口** 中打开主页面。
- **Harness 插件（bundle）**：`dsh plugin add` 可安装，为 agent 提供 `harness_launch` 工具（同样的检测→启动→等待→打开逻辑），让 agent 自己也能拉起/恢复 harness。

> **平台支持**：macOS / Windows 完整支持（已实测）；Linux 已适配代码（`google-chrome` 新窗口、`.desktop` 快捷方式）但尚未在真实环境验证，遇到问题欢迎提 issue。

![logo](assets/logo.png)

## 安装

### 作为 CLI 工具

```bash
# 从 git 仓库（推荐，一键复制）
npm install -g git+https://github.com/shaun5297/dsh-launcher.git

# 或从本地路径
npm install -g /path/to/dsh-launcher
```

安装后即可使用 `dsh-launcher` 命令。

### 作为 Harness 插件

```bash
dsh plugin --profile web add dsh-launcher
```

刷新页面（或重启 `dsh web`）后，agent 即获得 `harness_launch` 工具：检测后台 → 启动（若未运行）→ 等待就绪 → Chrome 新窗口打开主页面。插件配置可通过环境变量覆盖：

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `DSH_LAUNCHER_HOST` | `127.0.0.1` | 后台监听主机 |
| `DSH_LAUNCHER_PORT` | `3080` | 后台监听端口 |
| `DSH_LAUNCHER_BROWSER` | Chrome | 打开的浏览器 |

## 用法

```bash
# 一键启动（默认命令）：检测 → 启动后台（若未运行）→ 等待就绪 → Chrome 新窗口
dsh-launcher

# 等价写法
dsh-launcher start

# 后台已在运行时，仅打开主页面（不开新后台）
dsh-launcher open

# 查看后台状态（--json 输出 JSON 便于脚本化）
dsh-launcher status
dsh-launcher status --json   # {"running":true,"url":"http://127.0.0.1:3080/",...}

# 在桌面生成一键启动快捷方式（macOS .command / Windows .cmd / Linux .desktop）
dsh-launcher make-shortcut
```

> macOS 提示：首次双击生成的 `.command` 文件，若被系统拦截，请在「系统设置 → 隐私与安全性」中允许，或右键 → 打开。

### 常用选项

```bash
# 指定端口、补丁文件
dsh-launcher --port 3080 --patch ./enable-skills.yml --patch ./extra.yml

# 指定浏览器（默认 Chrome，新窗口打开）
dsh-launcher --browser "Microsoft Edge"

# 只启动后台，不打开浏览器
dsh-launcher --no-open

# 演练模式：只打印将要执行的命令，不做任何事
dsh-launcher --dry-run
```

完整帮助：`dsh-launcher --help`。

## 工作原理

1. **检测**：TCP 探测 `--host:--port`（默认 `127.0.0.1:3080`）是否已在监听。
2. **启动**：未运行则 detached 启动 `dsh --profile web --host … --port … --no-open`（浏览器由本工具负责，避免重复打开），stdout/stderr 追加到 `~/Library/Logs/dsh-web.log`（macOS）或 `~/.dsh/dsh-web.log`。
3. **等待**：轮询 HTTP 就绪，默认超时 60 秒（`--timeout` 可调）。
4. **打开**：在当前平台以 **新窗口** 打开主页面：
   - macOS：`open -na "Google Chrome" --args --new-window <url>`
   - Windows：`start chrome --new-window <url>`
   - Linux：`google-chrome --new-window <url>`（找不到 Chrome 时回退 `xdg-open`）
   - 浏览器打开失败时自动回退默认浏览器。

日志：`~/Library/Logs/dsh-launcher.log`（macOS）或 `~/.dsh/dsh-launcher.log`（Windows / Linux）。

## 平台支持

| 平台 | 启动后台 | 浏览器新窗口 | 桌面快捷方式 | 实测状态 |
|---|---|---|---|---|
| macOS | ✅ | ✅ `open -na "Google Chrome" --new-window` | ✅ `.command` | ✅ 已实测 |
| Windows | ✅ | ✅ `start chrome --new-window` | ✅ `.cmd` | ✅ 已实测 |
| Linux | ✅ | ✅ `google-chrome --new-window`（回退 `xdg-open`） | ✅ `.desktop` | ⚠️ 代码已适配，未实测 |

浏览器打开失败时会自动回退系统默认浏览器。

## 从桌面图标一键启动

```bash
dsh-launcher make-shortcut
```

在桌面生成「DeepSeek Harness 一键启动」图标，双击即完成整套启动 + 打开流程（相当于把上面的 CLI 封装成双击即可用的桌面入口）。

## 开发

```bash
npm test          # 运行单元测试
node bin/dsh-launcher.js --help
```

## License

MIT
