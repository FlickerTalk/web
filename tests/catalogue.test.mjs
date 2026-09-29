// The catalogue of plugins the app downloads from here (Plan §56): a signed index and the
// packages next to it. The app checks the signature and the hash; these tests check that what is
// served is in step with itself, so a rebuilt package with a stale index never reaches a phone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const plugins = join(root, "site", "plugins");
const HOME = "https://flickertalk.com/plugins/";

// Two indexes (2026-09-28): catalogue.json, everything, read by the app from 1.1.0 on; and
// index.json, read by the app 1.0.0, which ignores minCoreVersion and so gets only what runs there.
const INDEXES = ["catalogue.json", "index.json"];
const LEGACY_CORE = "1.0.0";
const read = (name) => JSON.parse(readFileSync(join(plugins, name), "utf8")).plugins;
const parts = (version) => version.split(".").map(Number);
const atLeast = (version, than) => {
  const [a, b] = [parts(version), parts(than)];
  for (let at = 0; at < Math.max(a.length, b.length); at++) if ((a[at] ?? 0) !== (b[at] ?? 0)) return (a[at] ?? 0) > (b[at] ?? 0);
  return true;
};

test("both indexes are signed", () => {
  for (const name of INDEXES) {
    const signature = readFileSync(join(plugins, `${name}.sig`), "utf8").trim();
    assert.match(signature, /^[A-Za-z0-9+/]{80,}={0,2}$/, `${name}: the signature is base64`);
  }
});

test("the app 1.0.0 is offered only what runs on it, and nothing the other index lacks", () => {
  const all = read("catalogue.json");
  for (const plugin of read("index.json")) {
    assert.ok(atLeast(LEGACY_CORE, plugin.minCoreVersion), `${plugin.id} needs ${plugin.minCoreVersion}: not for the app 1.0.0`);
    assert.ok(all.some((one) => one.id === plugin.id && one.hash === plugin.hash), `${plugin.id} is in catalogue.json too`);
  }
});

test("every plugin listed is served from here, and is the file that was listed", () => {
  const listed = INDEXES.flatMap(read);
  assert.ok(listed.length > 0, "the catalogue offers something");
  for (const plugin of listed) {
    assert.ok(plugin.url.startsWith(HOME), `${plugin.id} is served from our own site`);
    assert.match(plugin.id, /^[a-z0-9.]+$/);
    assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
    assert.ok(plugin.summary.length > 10, `${plugin.id} says what it does`);
    assert.match(plugin.hash, /^[0-9a-f]{64}$/);

    const path = join(plugins, plugin.url.slice(HOME.length));
    assert.ok(existsSync(path), `${plugin.url} is really there`);
    assert.equal(statSync(path).size, plugin.size, `${plugin.id} is the size the index says`);
  }
});

test("nothing of the catalogue is a page of the site", () => {
  assert.ok(!existsSync(join(plugins, "index.html")), "the catalogue is data, not a page");
});
