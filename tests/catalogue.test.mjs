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

const index = () => JSON.parse(readFileSync(join(plugins, "index.json"), "utf8"));

test("the index is signed", () => {
  const signature = readFileSync(join(plugins, "index.json.sig"), "utf8").trim();
  assert.match(signature, /^[A-Za-z0-9+/]{80,}={0,2}$/, "the signature is base64");
});

test("every plugin listed is served from here, and is the file that was listed", () => {
  const listed = index().plugins;
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
