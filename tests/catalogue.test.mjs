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

// Games (2026-10-02, plan of the games): only an app from GAMES_SINCE on tells a game from a tool;
// an older one would show it among the tools. So index.json (the app 1.0.0) never lists a game,
// and a game in catalogue.json asks for a core that knows games. `ftcatalogue` refuses to build
// anything else; this checks what is really served.
const GAMES_SINCE = "1.3.0";
const gamesIn = (listed) => listed.filter((plugin) => plugin.kind === "game").map((plugin) => plugin.id);
const gamesForOldApps = (listed) => gamesIn(listed.filter((plugin) => !atLeast(plugin.minCoreVersion, GAMES_SINCE)));

test("the game checks spot a game where an old app would see it", () => {
  const listed = [
    { id: "com.flickertalk.sketch", minCoreVersion: "0.1.0" },
    { id: "com.flickertalk.notes", minCoreVersion: "1.1.0", kind: "tool" },
    { id: "com.flickertalk.game.chess", minCoreVersion: "1.3.0", kind: "game" },
    { id: "com.flickertalk.game.dots", minCoreVersion: "1.2.0", kind: "game" },
  ];
  assert.deepEqual(gamesIn(listed), ["com.flickertalk.game.chess", "com.flickertalk.game.dots"]);
  assert.deepEqual(gamesForOldApps(listed), ["com.flickertalk.game.dots"]);
});

test("no app older than games is offered one", () => {
  assert.deepEqual(gamesIn(read("index.json")), [], "the app 1.0.0 is offered no game");
  assert.deepEqual(gamesForOldApps(read("catalogue.json")), [], `every game needs ${GAMES_SINCE} or newer`);
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

// Names and summaries in the app's languages (2026-10-02, plan of the catalogue's translations):
// each entry copies its manifest's `locales`, so the app shows a plugin in the phone's language
// before installing it. The app's 20 languages besides English; the limits are the ones the app
// enforces on a manifest. Markdown and PDF are formats: they keep their English name everywhere.
const LANGUAGES = ["es", "pt", "fr", "de", "it", "ro", "ru", "uk", "pl", "tr", "ar", "hi", "bn", "id", "vi", "th", "ja", "ko", "zh-CN", "zh-TW"];
const NAME_LIMIT = 64;
const SUMMARY_LIMIT = 200;
const KEEPS_ITS_NAME = ["com.flickertalk.markdown", "com.flickertalk.pdf"];
const length = (text) => [...text].length;

test("every plugin listed says its name and summary in each of the app's languages", () => {
  for (const plugin of read("catalogue.json")) {
    const locales = plugin.locales ?? {};
    assert.deepEqual(Object.keys(locales).sort(), [...LANGUAGES].sort(), `${plugin.id} speaks the app's languages`);
    for (const code of LANGUAGES) {
      const { name, summary } = locales[code];
      assert.equal(typeof summary, "string", `${plugin.id} has a summary in ${code}`);
      assert.ok(summary.trim().length > 0 && length(summary) <= SUMMARY_LIMIT, `${plugin.id}: the summary in ${code} fits`);
      if (KEEPS_ITS_NAME.includes(plugin.id)) {
        assert.equal(name, undefined, `${plugin.id} keeps its English name in ${code}`);
      } else {
        assert.equal(typeof name, "string", `${plugin.id} has a name in ${code}`);
        assert.ok(name.trim().length > 0 && length(name) <= NAME_LIMIT, `${plugin.id}: the name in ${code} fits`);
      }
    }
  }
});

test("nothing of the catalogue is a page of the site", () => {
  assert.ok(!existsSync(join(plugins, "index.html")), "the catalogue is data, not a page");
});
