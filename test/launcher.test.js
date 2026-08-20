import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULTS,
  urlFor,
  portOpen,
  httpReady,
  resolveDshBin,
  openInNewWindow,
  platform,
  startBackend,
} from "../lib/launcher.js";

test("urlFor builds correct URLs", () => {
  assert.equal(urlFor("127.0.0.1", 3080), "http://127.0.0.1:3080/");
  assert.equal(urlFor("0.0.0.0", 80), "http://0.0.0.0:80/");
  assert.equal(urlFor("::1", 3080), "http://[::1]:3080/");
});

test("defaults are sane", () => {
  assert.equal(DEFAULTS.host, "127.0.0.1");
  assert.equal(DEFAULTS.port, 3080);
  assert.equal(DEFAULTS.profile, "web");
  assert.ok(DEFAULTS.timeoutSeconds >= 10);
});

test("portOpen false on a closed port", async () => {
  // Pick a port that is almost certainly closed: bind a listener, note its
  // port, close it, then probe — the port should be free.
  const net = await import("node:net");
  const srv = net.createServer();
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const { port } = srv.address();
  await new Promise((r) => srv.close(r));
  assert.equal(await portOpen("127.0.0.1", port), false);
});

test("httpReady false when nothing listens", async () => {
  const net = await import("node:net");
  const srv = net.createServer();
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const { port } = srv.address();
  await new Promise((r) => srv.close(r));
  assert.equal(await httpReady("127.0.0.1", port), false);
});

test("resolveDshBin honors an existing DSH_BIN override and falls back otherwise", async () => {
  const prev = process.env.DSH_BIN;
  try {
    process.env.DSH_BIN = "/nonexistent/dsh";
    // Nonexistent override is ignored (falls back to a resolved path).
    const fallback = resolveDshBin();
    assert.ok(fallback.length > 0);
    assert.notEqual(fallback, "/nonexistent/dsh");

    // An existing override wins.
    process.env.DSH_BIN = new URL(import.meta.url).pathname; // a real file
    assert.equal(resolveDshBin(), process.env.DSH_BIN);
  } finally {
    if (prev === undefined) delete process.env.DSH_BIN;
    else process.env.DSH_BIN = prev;
  }
});

test("openInNewWindow returns a command array for the current platform", () => {
  const cmd = openInNewWindow("http://127.0.0.1:3080/");
  assert.ok(Array.isArray(cmd));
  assert.ok(cmd.length >= 3);
  assert.ok(cmd.join(" ").includes("http://127.0.0.1:3080/"));
  const named = openInNewWindow("http://x/", { browser: "Edge" });
  assert.ok(named.join(" ").includes("Edge"));
});

test("startBackend creates missing log dir and returns detached child", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dsh-launcher-log-"));
  const logFile = join(dir, "nested", "deep", "web.log");
  const child = startBackend({
    dshBin: process.execPath, // node itself: runs and exits, but spawn should succeed
    profile: "web",
    host: "127.0.0.1",
    port: 30999,
    webLogFile: logFile,
  });
  assert.ok(child);
  assert.ok(existsSync(join(dir, "nested", "deep")), "log dir should be created");
  await new Promise((r) => child.once("close", r));
  child.kill(); // no-op if already closed
});
