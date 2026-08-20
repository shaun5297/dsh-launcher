import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { parseArgs } from "../bin/dsh-launcher.js";

test("defaults to start command with sane defaults", () => {
  const o = parseArgs([]);
  assert.equal(o.command, "start");
  assert.equal(o.host, "127.0.0.1");
  assert.equal(o.port, 3080);
  assert.equal(o.profile, "web");
  assert.equal(o.noOpen, false);
  assert.equal(o.dryRun, false);
});

test("parses subcommand and options", () => {
  const o = parseArgs(["open", "--port", "8080", "--no-open", "--dry-run"]);
  assert.equal(o.command, "open");
  assert.equal(o.port, 8080);
  assert.equal(o.noOpen, true);
  assert.equal(o.dryRun, true);
});

test("repeatable --patch and --browser", () => {
  const o = parseArgs([
    "--patch", "./a.yml",
    "--patch", "./b.yml",
    "--browser", "Microsoft Edge",
  ]);
  assert.deepEqual(o.patches, ["./a.yml", "./b.yml"]);
  assert.equal(o.browser, "Microsoft Edge");
});

test("--timeout is parsed as number", () => {
  const o = parseArgs(["--timeout", "30"]);
  assert.equal(o.timeoutSeconds, 30);
});

test("unknown option exits with code 2", () => {
  const spy = [];
  const origErr = console.error;
  const origExit = process.exit;
  console.error = (m) => spy.push(m);
  process.exit = (c) => { throw new Error(`exit ${c}`); };
  try {
    assert.throws(() => parseArgs(["--bogus"]), /exit 2/);
  } finally {
    console.error = origErr;
    process.exit = origExit;
  }
});

test("--json flag is parsed", () => {
  const o = parseArgs(["status", "--json"]);
  assert.equal(o.command, "status");
  assert.equal(o.json, true);
});

test("bin entrypoint runs when invoked directly", () => {
  const res = spawnSync(process.execPath, ["bin/dsh-launcher.js", "--help"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /Usage:/);
});
