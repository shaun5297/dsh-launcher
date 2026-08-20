# dsh-launcher

一键启动 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 CLI 工具：检测后台是否在运行，未运行则自动启动 `dsh web`，等待就绪后在 **Chrome 新窗口** 中打开主页面。零依赖，跨平台（macOS / Windows / Linux）。

![logo](assets/logo.png)

## 安装

```bash
# 从本地路径
npm install -g /path/to/dsh-launcher

# 或从 git 仓库
npm install -g git+https://github.com/<you>/dsh-launcher.git
```

安装后即可使用 `dsh-launcher` 命令。

## 用法

```bash
# 一键启动（默认命令）：检测 → 启动后台（若未运行）→ 等待就绪 → Chrome 新窗口
dsh-launcher

# 等价写法
dsh-launcher start

# 后台已在运行时，仅打开主页面（不开新后台）
dsh-launcher open

# 查看后台状态
dsh-launcher status

# 在桌面生成一键启动快捷方式（.command / .cmd / .desktop）
dsh-launcher make-shortcut
```

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

日志：`~/Library/Logs/dsh-launcher.log`（macOS）或 `~/.dsh/dsh-launcher.log`。

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
