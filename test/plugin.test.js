import test from "node:test";
import assert from "node:assert/strict";
import { apply, launch, normalizeConfig } from "../src/index.js";

function mockCtx() {
  const registered = [];
  return {
    tools: { register: (def) => registered.push(def) },
    registered,
  };
}

test("normalizeConfig fills defaults and coerces port", () => {
  assert.deepEqual(normalizeConfig({}), { host: "127.0.0.1", port: 3080, profile: "web", timeoutSeconds: 60, browser: undefined });
  assert.deepEqual(normalizeConfig({ host: "0.0.0.0", port: "8080", browser: "Edge" }), { host: "0.0.0.0", port: 8080, profile: "web", timeoutSeconds: 60, browser: "Edge" });
  assert.equal(normalizeConfig({ port: "abc" }).port, 3080); // invalid -> default
});

test("apply registers the harness_launch tool", async () => {
  const ctx = mockCtx();
  await apply(ctx, {});
  assert.equal(ctx.registered.length, 1);
  const tool = ctx.registered[0];
  assert.equal(tool.name, "harness_launch");
  assert.ok(tool.description.includes("new window"));
  assert.ok(tool.parameters.properties.open);
  assert.ok(tool.parameters.properties.browser);
});

test("launch reports already-running backend and opens browser", async () => {
  // Both port probes succeed and the browser command always "runs".
  // We simulate with a real listener so portOpen sees it listening.
  const net = await import("node:net");
  const srv = net.createServer();
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const { port } = srv.address();

  const report = [];
  const result = await launch({
    host: "127.0.0.1",
    port,
    profile: "web",
    timeoutSeconds: 5,
    log: (m) => report.push(m),
  });
  assert.equal(result.ok, true);
  assert.ok(report.some((l) => l.includes("already running")));
  await new Promise((r) => srv.close(r));
});
