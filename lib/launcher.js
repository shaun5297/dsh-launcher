/**
 * dsh-launcher — core library.
 * Zero dependencies: cross-platform backend detection/startup/wait and
 * browser-new-window opening for DeepSeek Harness.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, openSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import net from "node:net";
import http from "node:http";

export const DEFAULTS = Object.freeze({
  host: "127.0.0.1",
  port: 3080,
  profile: "web",
  timeoutSeconds: 60,
  pollIntervalMs: 500,
  chromeNames: ["Google Chrome", "Chrome", "chrome", "Chromium", "Microsoft Edge", "edge"],
});

/** Best-effort resolve of the `dsh` CLI binary. Returns "dsh" (PATH lookup) or an absolute path. */
export function resolveDshBin(env = process.env) {
  const explicit = env.DSH_BIN;
  if (explicit && existsSync(explicit)) return explicit;
  if (env.DSH_HOME) {
    const candidates = [
      join(env.DSH_HOME, "bin", "dsh"),
      join(env.DSH_HOME, "bin", "dsh.cmd"),
      join(env.DSH_HOME, "node_modules", ".bin", "dsh"),
      join(env.DSH_HOME, "node_modules", ".bin", "dsh.cmd"),
    ];
    for (const c of candidates) if (existsSync(c)) return c;
  }
  if (process.platform === "win32" && env.APPDATA) {
    const npmShim = join(env.APPDATA, "npm", "dsh.cmd");
    if (existsSync(npmShim)) return npmShim;
  }
  const fnm = join(homedir(), ".local", "share", "fnm", "aliases", "default", "bin", "dsh");
  if (existsSync(fnm)) return fnm;
  return "dsh"; // let PATH resolve it
}

/**
 * Is something already listening on host:port?
 */
export function portOpen(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

/**
 * Probe the web app root with an HTTP GET. Resolves true when the server
 * responds with any HTTP status (server is up and accepting requests).
 */
export function httpReady(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: "/", timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(true);
    });
    req.once("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.once("error", () => resolve(false));
  });
}

export function urlFor(host, port) {
  const h = host.includes(":") ? `[${host}]` : host;
  return `http://${h}:${port}/`;
}

/**
 * Start the dsh backend detached from this process (survives CLI exit),
 * logging web output to `webLogFile`. Binds host/port explicitly and keeps
 * dsh from auto-opening the default browser (the launcher owns the browser).
 * Resolves the spawned child (detached).
 */
export function startBackend({ dshBin, profile, patches = [], host, port, webLogFile, env = process.env }) {
  const args = ["--profile", profile, "--host", host, "--port", String(port), "--no-open"];
  for (const p of patches) args.push("--patch", p);
  let stdio = ["ignore", "ignore", "ignore"];
  if (webLogFile) {
    mkdirSync(dirname(webLogFile), { recursive: true });
    const fd = openSync(webLogFile, "a");
    stdio = ["ignore", fd, fd];
  }
  const command = windowsCommandShim(dshBin) ? "cmd.exe" : dshBin;
  const commandArgs = windowsCommandShim(dshBin) ? ["/d", "/s", "/c", dshBin, ...args] : args;
  const child = spawn(command, commandArgs, {
    detached: true,
    stdio,
    env: { ...env },
    windowsHide: true,
  });
  child.unref();
  return child;
}

function windowsCommandShim(file) {
  return process.platform === "win32" && /\.(?:cmd|bat)$/i.test(file);
}

/**
 * Wait until the server responds, polling `pollIntervalMs`. Resolves true on
 * readiness, false on timeout.
 */
export async function waitUntilReady(host, port, { timeoutSeconds, pollIntervalMs } = DEFAULTS) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    if (await httpReady(host, port)) return true;
    await sleep(pollIntervalMs);
  }
  return await httpReady(host, port);
}

/** Platform helpers ------------------------------------------------------ */

export const platform = process.platform; // "darwin" | "win32" | "linux" | ...

/**
 * Open a URL in a NEW WINDOW of a named browser, or the default browser.
 * Returns the shell command that was run (for logging / dry-run).
 */
export function openInNewWindow(url, { browser } = {}) {
  if (process.platform === "darwin") return openMac(url, browser);
  if (process.platform === "win32") return openWindows(url, browser);
  return openLinux(url, browser);
}

function openMac(url, browser) {
  if (browser && browser !== "default") {
    return ["open", "-na", browser, "--args", "--new-window", url];
  }
  // Chrome by default (matches the original one-click app), fallback handled by `open`.
  return ["open", "-na", "Google Chrome", "--args", "--new-window", url];
}

function openWindows(url, browser) {
  if (browser && browser !== "default") {
    return ["cmd", "/c", "start", "", browser, "--new-window", url];
  }
  return ["cmd", "/c", "start", "", "chrome", "--new-window", url];
}

function openLinux(url, browser) {
  if (browser && browser !== "default") {
    return [browser, "--new-window", url];
  }
  const chrome = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]
    .find((c) => commandExists(c));
  if (chrome) return [chrome, "--new-window", url];
  return ["xdg-open", url];
}

function commandExists(cmd) {
  try {
    execFileSync(cmd, ["--version"], { stdio: "ignore", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/** Run a command array; returns { ok, stdout, stderr }. Never throws. */
export function runCommand(cmd, { log = () => {} } = {}) {
  log(`$ ${cmd.join(" ")}`);
  return new Promise((resolve) => {
    const child = spawn(cmd[0], cmd.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.once("error", (e) => resolve({ ok: false, stdout, stderr, error: e.message }));
    child.once("close", (code) => resolve({ ok: code === 0, stdout, stderr, code }));
  });
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
