import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import downloads from "../njs/downloads.js";

const PACKAGE = "/plugins/com.flickertalk.game.chess/1.0.6.ftplugin";
const NOV_15 = new Date(Date.UTC(2026, 10, 15, 12, 0, 0));

const download = (overrides = {}) => ({ method: "GET", status: 200, uri: PACKAGE, now: NOV_15, ...overrides });

const fakeDict = (keys = []) => {
  const totals = new Map(keys.map((key) => [key, 1]));
  return {
    totals,
    incr(key, delta) {
      totals.set(key, (totals.get(key) ?? 0) + delta);
      return totals.get(key);
    },
    keys(maxCount = 1024) {
      return [...totals.keys()].slice(0, maxCount);
    },
    delete(key) {
      return totals.delete(key);
    },
  };
};

const withDict = (dict, run) => {
  const previous = globalThis.ngx;
  globalThis.ngx = { shared: { downloads: dict } };
  try {
    run();
  } finally {
    globalThis.ngx = previous;
  }
};

const nginxRequest = (overrides = {}) => ({
  method: "GET",
  status: 200,
  uri: PACKAGE,
  headersIn: {},
  ...overrides,
});

test("a GET answered 200 for a package counts under its month, id, version and the app", () => {
  assert.equal(downloads.downloadKey(download()), "2026-11|com.flickertalk.game.chess|1.0.6|app");
});

test("a request with a User-Agent counts as other and the header's value is not kept", () => {
  const key = downloads.downloadKey(download({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)" }));
  assert.equal(key, "2026-11|com.flickertalk.game.chess|1.0.6|other");
  assert.doesNotMatch(key, /Mozilla/);
});

test("a request with an empty User-Agent is the app", () => {
  assert.equal(downloads.downloadKey(download({ userAgent: "" })), "2026-11|com.flickertalk.game.chess|1.0.6|app");
});

test("HEAD, 304, 404, 206 and range requests count nothing", () => {
  assert.equal(downloads.downloadKey(download({ method: "HEAD" })), null);
  assert.equal(downloads.downloadKey(download({ method: "POST" })), null);
  for (const status of [206, 304, 404, 416, 500]) {
    assert.equal(downloads.downloadKey(download({ status })), null, `status ${status}`);
  }
  assert.equal(downloads.downloadKey(download({ range: "bytes=0-99" })), null);
});

test("the indexes, their signatures and any other path count nothing", () => {
  for (const uri of [
    "/plugins/catalogue.json",
    "/plugins/catalogue.json.sig",
    "/plugins/index.json",
    "/plugins/index.json.sig",
    "/privacy/",
    "/",
    "/plugins/com.flickertalk.game.chess/",
    "/plugins/com.flickertalk.game.chess/1.0.6.ftplugin/more",
    "/plugins/com.flickertalk.game.chess/nested/1.0.6.ftplugin",
    "/plugins/org.example.tool/1.0.0.ftplugin",
    "/elsewhere/com.flickertalk.game.chess/1.0.6.ftplugin",
    "/plugins/com.flickertalk.game|chess/1.0.6.ftplugin",
    "/plugins/com.flickertalk.game.chess/1.0|6.ftplugin",
  ]) {
    assert.equal(downloads.downloadKey(download({ uri })), null, uri);
  }
});

test("the month is the UTC month", () => {
  const lateInBrazil = new Date("2026-11-30T23:30:00-03:00");
  const earlyInMadrid = new Date("2026-12-01T00:30:00+01:00");
  assert.equal(downloads.downloadKey(download({ now: lateInBrazil })), "2026-12|com.flickertalk.game.chess|1.0.6|app");
  assert.equal(downloads.downloadKey(download({ now: earlyInMadrid })), "2026-11|com.flickertalk.game.chess|1.0.6|app");
  assert.equal(downloads.downloadKey(download({ now: new Date(Date.UTC(2027, 0, 1)) })), "2027-01|com.flickertalk.game.chess|1.0.6|app");
});

test("count adds one to the total of the request's key", () => {
  const dict = fakeDict();
  withDict(dict, () => {
    downloads.count(nginxRequest(), NOV_15);
    downloads.count(nginxRequest(), NOV_15);
    downloads.count(nginxRequest({ headersIn: { "User-Agent": "curl/8.7.1" } }), NOV_15);
  });
  assert.deepEqual(Object.fromEntries(dict.totals), {
    "2026-11|com.flickertalk.game.chess|1.0.6|app": 2,
    "2026-11|com.flickertalk.game.chess|1.0.6|other": 1,
  });
});

test("count reads only the method, status, path, User-Agent and Range of the request", () => {
  const dict = fakeDict();
  const read = new Set();
  const spy = (target, prefix) =>
    new Proxy(target, {
      get(object, property) {
        if (typeof property === "string") read.add(prefix + property);
        return object[property];
      },
    });
  const headers = spy({ "User-Agent": "curl/8.7.1", Cookie: "a=b", "X-Forwarded-For": "203.0.113.9" }, "headersIn.");
  withDict(dict, () => downloads.count(spy(nginxRequest({ headersIn: headers, remoteAddress: "203.0.113.9" }), ""), NOV_15));
  const allowed = new Set(["method", "status", "uri", "headersIn", "headersIn.User-Agent", "headersIn.Range"]);
  assert.deepEqual([...read].filter((name) => !allowed.has(name)), []);
});

test("count adds nothing for a request that is not a download", () => {
  const dict = fakeDict();
  withDict(dict, () => {
    downloads.count(nginxRequest({ method: "HEAD" }), NOV_15);
    downloads.count(nginxRequest({ status: 404 }), NOV_15);
    downloads.count(nginxRequest({ uri: "/plugins/catalogue.json" }), NOV_15);
    downloads.count(nginxRequest({ headersIn: { Range: "bytes=0-99" } }), NOV_15);
  });
  assert.equal(dict.totals.size, 0);
});

test("count never fails a download when the total cannot be updated", () => {
  const full = {
    incr() {
      throw new Error("SharedMemoryError: no memory");
    },
  };
  withDict(full, () => assert.doesNotThrow(() => downloads.count(nginxRequest(), NOV_15)));
});

test("count uses the current month when none is given", () => {
  const dict = fakeDict();
  withDict(dict, () => downloads.count(nginxRequest()));
  const month = new Date().toISOString().slice(0, 7);
  assert.deepEqual([...dict.totals.keys()], [`${month}|com.flickertalk.game.chess|1.0.6|app`]);
});

test("prune keeps the current month and the 24 before it", () => {
  const months = [];
  for (let back = 0; back <= 30; back += 1) {
    months.push(new Date(Date.UTC(2026, 10 - back, 1)).toISOString().slice(0, 7));
  }
  const dict = fakeDict(months.flatMap((month) => [`${month}|com.flickertalk.board|1.1.4|app`, `${month}|com.flickertalk.board|1.1.4|other`]));
  withDict(dict, () => downloads.prune(undefined, NOV_15));
  const kept = [...new Set([...dict.totals.keys()].map((key) => key.slice(0, 7)))].sort();
  assert.equal(kept.length, 25);
  assert.equal(kept[0], "2024-11");
  assert.equal(kept[24], "2026-11");
  assert.equal(dict.totals.size, 50);
});

test("prune counts the 25 months across the turn of a year", () => {
  const dict = fakeDict(["2024-12|com.flickertalk.board|1.1.4|app", "2025-01|com.flickertalk.board|1.1.4|app", "2027-01|com.flickertalk.board|1.1.4|app"]);
  withDict(dict, () => downloads.prune(undefined, new Date(Date.UTC(2027, 0, 20))));
  assert.deepEqual([...dict.totals.keys()], ["2025-01|com.flickertalk.board|1.1.4|app", "2027-01|com.flickertalk.board|1.1.4|app"]);
});

test("prune sees every total, not only the first 1024 the dictionary lists by default", () => {
  const old = Array.from({ length: 1500 }, (_, at) => `2020-01|com.flickertalk.board|1.0.${at}|app`);
  const dict = fakeDict([...old, "2026-11|com.flickertalk.board|1.1.4|app"]);
  withDict(dict, () => downloads.prune(undefined, NOV_15));
  assert.deepEqual([...dict.totals.keys()], ["2026-11|com.flickertalk.board|1.1.4|app"]);
});

test("every package the catalogue serves is counted under its own id and version", () => {
  const catalogue = JSON.parse(readFileSync(new URL("../site/plugins/catalogue.json", import.meta.url), "utf8"));
  assert.ok(catalogue.plugins.length > 0);
  for (const plugin of catalogue.plugins) {
    const uri = new URL(plugin.url).pathname;
    assert.equal(downloads.downloadKey(download({ uri })), `2026-11|${plugin.id}|${plugin.version}|app`, uri);
  }
});
