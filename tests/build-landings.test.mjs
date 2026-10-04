// The /add and /move landings in the app's languages (2026-10-04). Whoever opens a contact or
// move link in the browser reads the steps in their own language, with the button names the app
// shows them. The pages are static: scripts/build-landings.mjs writes them from landing/<lang>.json,
// and nginx picks one by the browser's first language, at the same address, without a redirect.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../scripts/build-landings.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");

// The languages of the app (app/src/i18n/<lang>.json). English is the source.
const LANGUAGES = ["ar", "bn", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "pl", "pt", "ro", "ru", "th", "tr", "uk", "vi", "zh-CN", "zh-TW"];
const LANDINGS = ["add", "move"];
// The app's own button and screen names each page quotes. They are copied verbatim into
// landing/<lang>.json ("labels") from app/src/i18n/<lang>.json, under the same keys, so the page
// shows exactly what the app shows. Never translated here.
const LABELS = {
  add: ["addContact.title", "addContact.scan", "addContact.paste", "addContact.add", "tabs.chats"],
  move: ["welcome.fromOld", "tabs.settings", "settings.movePhone", "move.scan", "move.paste", "move.go"],
};

const PLAY = "https://play.google.com/store/apps/details?id=com.flickertalk.app";
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fileOf = (lang) => (lang === "en" ? "index.html" : `${lang}.html`);
const strings = (lang) => JSON.parse(readFileSync(join(root, "landing", `${lang}.json`), "utf8"));
const read = (path) => readFileSync(join(site, path), "utf8");
const text = (path) => read(path).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ");
const copyKeys = (json) => Object.entries(json).filter(([section]) => section !== "labels").flatMap(([section, values]) => Object.keys(values).map((key) => `${section}.${key}`));
const copyOf = (json, path) => path.split(".").reduce((o, k) => o?.[k], json);

test("there are strings for every language of the app, and nothing else", () => {
  const files = readdirSync(join(root, "landing")).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  assert.deepEqual(files.sort(), [...LANGUAGES].sort());
});

test("every language has every piece of the copy, filled in and translated", () => {
  const english = strings("en");
  const keys = copyKeys(english);
  assert.ok(keys.length > 20, "the English copy is there");
  for (const lang of LANGUAGES) {
    const json = strings(lang);
    assert.deepEqual(copyKeys(json).sort(), [...keys].sort(), `${lang}: the same pieces as English`);
    for (const key of keys) {
      const value = copyOf(json, key);
      assert.equal(typeof value, "string", `${lang}: ${key}`);
      assert.ok(value.trim(), `${lang}: ${key} is not empty`);
      // Labels may coincide with English ("Chat"); the copy around them may not.
      if (lang !== "en") assert.notEqual(value, copyOf(english, key), `${lang}: ${key} is translated`);
    }
  }
});

test("every language has the app's labels each page quotes, and the copy uses all of them", () => {
  for (const lang of LANGUAGES) {
    const { labels, ...copy } = strings(lang);
    assert.deepEqual(Object.keys(labels).sort(), [...LABELS.add, ...LABELS.move].sort(), `${lang}: the labels`);
    for (const [key, value] of Object.entries(labels)) assert.ok(value.trim(), `${lang}: ${key} is not empty`);
    const used = [...JSON.stringify(copy).matchAll(/\{([\w.]+)\}/g)].map(([, key]) => key);
    for (const key of used) assert.ok(key in labels, `${lang}: {${key}} is a label`);
    for (const key of Object.keys(labels)) assert.ok(used.includes(key), `${lang}: {${key}} is used`);
  }
});

test("the committed pages are exactly what the generator writes", () => {
  const built = build();
  const expected = LANDINGS.flatMap((page) => LANGUAGES.map((lang) => `${page}/${fileOf(lang)}`));
  assert.deepEqual(Object.keys(built).sort(), [...expected].sort(), "one page per language and landing");
  for (const page of LANDINGS) {
    const onDisk = readdirSync(join(site, page)).map((f) => `${page}/${f}`);
    assert.deepEqual(onDisk.sort(), expected.filter((p) => p.startsWith(`${page}/`)).sort(), `${page}/ holds only generated pages`);
  }
  for (const [path, html] of Object.entries(built)) {
    assert.ok(existsSync(join(site, path)), `${path} is committed (npm run build-landings)`);
    assert.equal(read(path), html, `${path} is what the generator writes (npm run build-landings)`);
  }
});

test("every page is in its language, right to left only in Arabic, with English navigation", () => {
  for (const page of LANDINGS) {
    for (const lang of LANGUAGES) {
      const path = `${page}/${fileOf(lang)}`;
      const html = read(path);
      assert.match(html, new RegExp(`<html lang="${lang}"${lang === "ar" ? ' dir="rtl"' : ""}>`), `${path}: lang`);
      if (lang !== "ar") assert.doesNotMatch(html, /dir="rtl"/, `${path}: left to right`);
      assert.match(html, /<title>[^<]+ · FlickerTalk<\/title>/, `${path}: title`);
      assert.match(html, /<meta name="description" content="[^"]+"/, `${path}: description`);
      assert.match(html, /<meta name="robots" content="noindex">/, `${path}: noindex`);
      // The header and footer lead to the English site.
      if (lang !== "en") {
        assert.match(html, /<header class="wrap top" lang="en"( dir="ltr")?>/, `${path}: the header is marked English`);
        assert.match(html, /<footer class="wrap" lang="en"( dir="ltr")?>/, `${path}: the footer is marked English`);
      }
    }
  }
});

test("every page quotes its language's app labels verbatim and links Google Play with the badge", () => {
  for (const page of LANDINGS) {
    for (const lang of LANGUAGES) {
      const path = `${page}/${fileOf(lang)}`;
      const json = strings(lang);
      const words = text(path);
      for (const key of LABELS[page]) assert.ok(words.includes(json.labels[key]), `${path}: ${key} “${json.labels[key]}”`);
      assert.ok(words.includes(json.common.soon), `${path}: iOS is coming`);
      assert.ok(words.includes(json.common.fragment), `${path}: what the browser keeps to itself`);
      assert.ok(words.includes(json[page].h1), `${path}: its heading`);
      const links = [...read(path).matchAll(new RegExp(`<a\\s[^>]*href="${escape(PLAY)}"[^>]*>([\\s\\S]*?)</a>`, "g"))];
      assert.equal(links.length, 1, `${path}: Google Play`);
      assert.match(links[0][0], /\starget="_blank" rel="noopener"/, `${path}: in a new tab`);
      assert.match(links[0][1], /<img src="\/assets\/google-play-badge\.svg" alt="Get it on Google Play"/, `${path}: the badge`);
      assert.doesNotMatch(read(path), /\{[\w.]+\}/, `${path}: no placeholder left`);
    }
  }
});

// The map in nginx.conf, read and run here the way nginx runs it: regular expressions in order,
// the first that matches wins, otherwise the default.
const conf = () => readFileSync(join(root, "nginx.conf"), "utf8");
const landingMap = () => {
  const block = conf().match(/map \$http_accept_language \$landing_lang \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(block, "nginx.conf maps the browser's languages to a landing language");
  const fallback = block.match(/^\s*default\s+(\S+);/m)?.[1];
  const rules = [...block.matchAll(/^\s*"~(\*?)([^"]+)"\s+(\S+);/gm)].map(([, i, source, lang]) => [new RegExp(source, i ? "i" : ""), lang]);
  return (header) => rules.find(([regex]) => regex.test(header))?.[1] ?? fallback;
};

test("nginx picks the landing language from the browser's first language", () => {
  const pick = landingMap();
  const cases = {
    "": "en",
    "*": "en",
    xx: "en",
    "en-GB": "en",
    "en-US,es;q=0.9": "en",
    "es-ES,es;q=0.9,en;q=0.8": "es",
    "es-MX": "es",
    "pt-BR": "pt",
    "pt-PT,pt;q=0.9": "pt",
    DE: "de",
    "de-CH": "de",
    "fr-CA": "fr",
    "zh-TW": "zh-TW",
    "zh-HK": "zh-TW",
    "zh-MO": "zh-TW",
    "zh-Hant": "zh-TW",
    "zh-Hant-HK": "zh-TW",
    "zh-hant-tw": "zh-TW",
    zh: "zh-CN",
    "zh-CN": "zh-CN",
    "zh-SG": "zh-CN",
    "zh-Hans": "zh-CN",
    "zh-Hans-HK": "zh-CN",
    ar: "ar",
    "ar-EG,ar;q=0.9": "ar",
    "uk-UA": "uk",
    "ja-JP": "ja",
    // A language code that only starts like one of ours is not ours.
    fil: "en",
    roh: "en",
    itx: "en",
  };
  for (const [header, lang] of Object.entries(cases)) assert.equal(pick(header), lang, `Accept-Language: ${header}`);
  for (const lang of LANGUAGES) assert.equal(pick(lang), lang, `Accept-Language: ${lang}`);
});

test("nginx serves /add and /move in that language, at the same address, without a redirect", () => {
  const config = conf();
  for (const page of LANDINGS) {
    assert.match(
      config,
      new RegExp(`location = /${page} \\{\\s*try_files /${page}/\\$landing_lang\\.html /${page}/index\\.html =404;\\s*\\}`),
      `/${page} is served as it is, in the browser's language`
    );
  }
  assert.doesNotMatch(config, /\b(return\s+30\d|rewrite)\b/, "no redirect anywhere");
  // At server level: an add_header inside a location would drop the security headers.
  assert.match(config, /\n    add_header Vary "Accept-Language" always;/, "caches know the page depends on the language");
});
