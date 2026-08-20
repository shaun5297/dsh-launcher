#!/usr/bin/env node
/**
 * dsh-launcher — one-click launcher for DeepSeek Harness.
 *
 * Usage:
 *   dsh-launcher [start]          detect -> start backend if needed -> wait -> open Chrome
 *   dsh-launcher open             backend already running: open the main page in a new window
 *   dsh-launcher status           print backend state and exit
 *   dsh-launcher make-shortcut    create a desktop launcher icon/shortcut
 *
 * Options:
 *   --host <host>        bind host (default 127.0.0.1)
 *   --port <port>        port (default 3080)
 *   --profile <name>     dsh profile to boot (default web)
 *   --patch <path>       extra patch overlay (repeatable)
 *   --browser <name>     browser app name for the new window (default: Chrome)
 *   --timeout <seconds>  startup wait timeout (default 60)
 *   --log <file>         launcher log file
 *   --no-open            start the backend only, do not open a browser
 *   --dry-run            print what would run, do nothing
 *   -h, --help           show this help
 */
import { writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DEFAULTS,
  resolveDshBin,
  portOpen,
  urlFor,
  startBackend,
  waitUntilReady,
  openInNewWindow,
  runCommand,
  platform,
} from "../lib/launcher.js";

const USAGE = `dsh-launcher — one-click launcher for DeepSeek Harness

Usage:
  dsh-launcher [start]        detect -> start backend if needed -> wait -> open Chrome
  dsh-launcher open           backend already running: open the main page in a new window
  dsh-launcher status         print backend state and exit
  dsh-launcher make-shortcut  create a desktop launcher icon/shortcut

Options:
  --host <host>        bind host (default ${DEFAULTS.host})
  --port <port>        port (default ${DEFAULTS.port})
  --profile <name>     dsh profile to boot (default ${DEFAULTS.profile})
  --patch <path>       extra patch overlay (repeatable)
  --browser <name>     browser app name for the new window (default: Chrome)
  --timeout <seconds>  startup wait timeout (default ${DEFAULTS.timeoutSeconds})
  --log <file>         launcher log file
  --no-open            start the backend only, do not open a browser
  --dry-run            print what would run, do nothing
  --json               status output as JSON (status --json)
  -h, --help           show this help
`;

export function parseArgs(argv) {
  const opts = {
    command: "start",
    host: DEFAULTS.host,
    port: DEFAULTS.port,
    profile: DEFAULTS.profile,
    patches: [],
    browser: undefined,
    timeoutSeconds: DEFAULTS.timeoutSeconds,
    log: undefined,
    noOpen: false,
    dryRun: false,
    json: false,
    help: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "-h": case "--help": opts.help = true; break;
      case "--host": opts.host = next(); break;
      case "--port": opts.port = Number(next()); break;
      case "--profile": opts.profile = next(); break;
      case "--patch": opts.patches.push(next()); break;
      case "--browser": opts.browser = next(); break;
      case "--timeout": opts.timeoutSeconds = Number(next()); break;
      case "--log": opts.log = next(); break;
      case "--no-open": opts.noOpen = true; break;
      case "--dry-run": opts.dryRun = true; break;
      case "--json": opts.json = true; break;
      default:
        if (a.startsWith("-")) {
          console.error(`unknown option: ${a}\n\n${USAGE}`);
          process.exit(2);
        }
        positional.push(a);
    }
  }
  if (positional.length > 0) opts.command = positional[0];
  return opts;
}

function defaultLogFile() {
  const base = platform === "darwin"
    ? join(homedir(), "Library", "Logs")
    : join(homedir(), ".dsh");
  return join(base, "dsh-launcher.log");
}

function timestamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const logFile = opts.log ?? defaultLogFile();
  const logLines = [];
  const log = (msg) => {
    const line = `[${timestamp()}] ${msg}`;
    logLines.push(line);
    console.log(msg);
  };
  const flushLog = () => {
    try {
      const i = logFile.lastIndexOf("/");
      if (i > 0) mkdirSync(logFile.slice(0, i), { recursive: true });
      writeFileSync(logFile, logLines.join("\n") + "\n", { flag: "a" });
    } catch {}
  };

  const url = urlFor(opts.host, opts.port);

  if (opts.command === "status") {
    const up = await portOpen(opts.host, opts.port);
    const payload = { running: up, url, host: opts.host, port: opts.port };
    if (opts.json) {
      process.stdout.write(JSON.stringify(payload) + "\n");
    } else {
      console.log(`backend: ${up ? "RUNNING" : "STOPPED"} — ${url}`);
    }
    return up ? 0 : 1;
  }

  if (opts.command === "make-shortcut") {
    return await makeShortcut(opts, log);
  }

  // start / open ----------------------------------------------------------
  const running = await portOpen(opts.host, opts.port);
  if (running) {
    log(`backend already running: ${url}`);
  } else if (opts.command === "open") {
    log(`backend not running at ${url} (use "dsh-launcher start" to boot it)`);
    flushLog();
    return 1;
  } else {
    const dshBin = resolveDshBin();
    const argStr = ["--profile", opts.profile, "--host", opts.host, "--port", String(opts.port), "--no-open", ...opts.patches.flatMap((p) => ["--patch", p])].join(" ");
    log(`starting backend: ${dshBin} ${argStr}`);
    if (opts.dryRun) {
      log("(dry-run) would spawn detached backend");
    } else {
      startBackend({
        dshBin,
        profile: opts.profile,
        patches: opts.patches,
        host: opts.host,
        port: opts.port,
        webLogFile: logFile.replace(/launcher/, "web"),
      });
      log(`waiting for ${url} (timeout ${opts.timeoutSeconds}s)…`);
      const ready = await waitUntilReady(opts.host, opts.port, {
        timeoutSeconds: opts.timeoutSeconds,
      });
      if (!ready) {
        log(`ERROR: backend did not become ready within ${opts.timeoutSeconds}s`);
        flushLog();
        return 1;
      }
      log("backend ready");
    }
  }

  if (opts.noOpen || opts.dryRun) {
    if (opts.dryRun) log(`(dry-run) would open: ${url}`);
    flushLog();
    return 0;
  }

  const cmd = openInNewWindow(url, { browser: opts.browser });
  log(`opening new browser window: ${cmd.join(" ")}`);
  const res = await runCommand(cmd, { log });
  if (!res.ok) {
    log(`browser open returned ${res.code ?? res.error ?? "error"}: ${res.stderr.trim()}`);
    log("falling back to default browser");
    await runCommand(openInNewWindow(url, { browser: "default" }), { log });
  }
  flushLog();
  return 0;
}

export async function makeShortcut(opts, log, desktopDir) {
  const url = urlFor(opts.host, opts.port);
  const desktop = desktopDir ?? join(homedir(), "Desktop");
  try { mkdirSync(desktop, { recursive: true }); } catch {}

  // Re-invoke this same module with `node <absolute bin path> start …`
  const selfPath = fileURLToPath(import.meta.url);
  const patchArgs = opts.patches.map((p) => `--patch ${JSON.stringify(p)}`).join(" ");
  const baseArgs = `--host ${opts.host} --port ${opts.port} --profile ${opts.profile} ${patchArgs}`;

  if (platform === "darwin") {
    const target = join(desktop, "DeepSeek Harness 一键启动.command");
    const script = `#!/bin/bash
# DeepSeek Harness one-click launcher (generated by dsh-launcher)
exec "${process.execPath}" "${selfPath}" start ${baseArgs}
`;
    writeFileSync(target, script);
    chmodSync(target, 0o755);
    log(`created: ${target}`);
    log("tip: double-click it; the first launch may ask the Terminal for permission.");
    return 0;
  }
  if (platform === "win32") {
    const target = join(desktop, "DeepSeek Harness 一键启动.cmd");
    const content = `@echo off
REM DeepSeek Harness one-click launcher (generated by dsh-launcher)
"${process.execPath}" "${selfPath}" start ${baseArgs}
`;
    writeFileSync(target, content);
    log(`created: ${target}`);
    return 0;
  }
  // Linux
  const target = join(desktop, "deepseek-harness.desktop");
  const content = `[Desktop Entry]
Type=Application
Name=DeepSeek Harness 一键启动
Comment=One-click launcher for DeepSeek Harness
Exec=${process.execPath} ${selfPath} start ${baseArgs}
Terminal=false
Categories=Development;
Icon=utilities-terminal
`;
  writeFileSync(target, content);
  chmodSync(target, 0o755);
  log(`created: ${target}`);
  log(`tip: right-click the .desktop file -> "Allow Launching" (first time).`);
  return 0;
}

// Direct execution support (bin entry).
if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
