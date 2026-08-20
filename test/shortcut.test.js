import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeShortcut, parseArgs } from "../bin/dsh-launcher.js";

test("makeShortcut writes an executable .command on darwin", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dsh-launcher-test-"));
  const logs = [];
  const opts = parseArgs(["--port", "3080"]);
  const code = await makeShortcut(opts, (m) => logs.push(m), dir);
  assert.equal(code, 0);

  const target = process.platform === "darwin"
    ? join(dir, "DeepSeek Harness 一键启动.command")
    : process.platform === "win32"
      ? join(dir, "DeepSeek Harness 一键启动.cmd")
      : join(dir, "deepseek-harness.desktop");
  assert.ok(existsSync(target), `expected ${target}`);
  const content = readFileSync(target, "utf8");
  assert.ok(content.includes("dsh-launcher.js"));
  assert.ok(content.includes("--port 3080"));
  if (process.platform !== "win32") {
    assert.ok((statSync(target).mode & 0o111) !== 0, "should be executable");
  }
  assert.ok(logs.some((l) => l.includes("created")));
});
