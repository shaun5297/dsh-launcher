/**
 * dsh-launcher — DeepSeek Harness bundle plugin.
 *
 * Registers the `harness_launch` agent tool: detect whether the DSH backend
 * is running, start it if needed (detached), wait until ready, then open the
 * main page in a NEW WINDOW of the configured browser (Chrome by default).
 *
 * The same logic powers the `dsh-launcher` CLI (bin/dsh-launcher.js); this
 * bundle makes it installable via `dsh plugin add` so the agent itself can
 * relaunch the harness.
 */
import { defineTool } from "@deepseek-ai/dsh-tools";
import {
  portOpen,
  httpReady,
  urlFor,
  startBackend,
  waitUntilReady,
  openInNewWindow,
  runCommand,
  resolveDshBin,
} from "../lib/launcher.js";

export const name = "dsh-launcher";
export const inject = ["tools"];

const DEFAULTS = {
  host: "127.0.0.1",
  port: 3080,
  profile: "web",
  timeoutSeconds: 60,
};

export function normalizeConfig(config = {}) {
  const host = config.host ?? DEFAULTS.host;
  const port = Number(config.port ?? DEFAULTS.port);
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : DEFAULTS.port,
    profile: config.profile ?? DEFAULTS.profile,
    timeoutSeconds: Number(config.timeoutSeconds) > 0
      ? Number(config.timeoutSeconds)
      : DEFAULTS.timeoutSeconds,
    browser: typeof config.browser === "string" && config.browser ? config.browser : undefined,
  };
}

/**
 * Core action: ensure the backend is up, then open the browser. Returns a
 * short human-readable report for the tool output.
 */
export async function launch({ host, port, profile, timeoutSeconds, browser, log = () => {} }) {
  const url = urlFor(host, port);
  const report = [];
  const say = (m) => {
    report.push(m);
    log(m);
  };

  if (await portOpen(host, port)) {
    say(`backend already running: ${url}`);
  } else {
    const dshBin = resolveDshBin();
    say(`starting backend: ${dshBin} --profile ${profile} (${url})`);
    startBackend({ dshBin, profile, host, port });
    say(`waiting for ${url} (timeout ${timeoutSeconds}s)…`);
    const ready = await waitUntilReady(host, port, { timeoutSeconds });
    if (!ready) {
      say(`ERROR: backend did not become ready within ${timeoutSeconds}s`);
      return { ok: false, report: report.join("\n") };
    }
    say("backend ready");
  }

  const cmd = openInNewWindow(url, { browser });
  say(`opening browser new window: ${cmd.join(" ")}`);
  const res = await runCommand(cmd, { log });
  if (!res.ok) {
    say(`browser open failed (${res.code ?? res.error ?? "error"}); falling back to default browser`);
    await runCommand(openInNewWindow(url, { browser: "default" }), { log });
  }
  return { ok: true, report: report.join("\n") };
}

export async function apply(ctx, config = {}) {
  const cfg = normalizeConfig(config);

  const registration = defineTool({
    name: "harness_launch",
    description:
      "Launch or relaunch the DeepSeek Harness web UI: detects whether the backend is running, starts it if needed, waits until ready, then opens the main page in a new window of the configured browser (Chrome by default). Use this when the user asks to open/start the harness, or to recover from a broken session.",
    parameters: {
      browser: {
        type: "string",
        description:
          "Optional browser app name (e.g. 'Google Chrome', 'Microsoft Edge'). Defaults to the plugin config or Chrome.",
      },
      open: {
        type: "boolean",
        description:
          "Set false to only ensure the backend is running without opening a browser window. Defaults to true.",
      },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_args, value) => [
        { type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) },
      ],
    },
    async execute(args) {
      const open = args.open !== false;
      const result = await launch({
        host: cfg.host,
        port: cfg.port,
        profile: cfg.profile,
        timeoutSeconds: cfg.timeoutSeconds,
        browser: args.browser ?? cfg.browser,
      });
      return { ok: result.ok, report: result.report, opened: open ? result.ok : false };
    },
  });

  ctx.tools.register(registration);
}
