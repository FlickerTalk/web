// The /add and /move landings in the app's languages (2026-10-04). Whoever opens a contact or
// move link in the browser reads the steps in their own language, with the button names the app
// shows them. The pages are static: scripts/build-landings.mjs writes them from landing/<lang>.json,
// and nginx picks one by the browser's first language, at the same address, without a redirect.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const APP_STORE = "https://apps.apple.com/app/id6817480081";
// Apple's localized "Download on the App Store" badges (black, SVG), as Apple's App Store Marketing
// Tools serve them (toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/
// <locale>), byte for byte: the guidelines forbid altering them. The alt text is the badge's own
// wording. Brazilian Portuguese, like landing/pt.json. Apple's tool has no Hindi badge: Hindi shows
// the English one.
const APPLE_BADGES = {
  ar: ["ar", "تنزيل من App Store", "1824fcf05bd3d5a01d0992f6eae6f6d5b26e4a2db07a144d56fa0e12216c238d"],
  bn: ["bn", "App Store থেকে ডাউনলোড করুন", "82002cc0ee11538883a4e87de7ae0d10210730cb5ceeab4dce14dfe81fe1db36"],
  de: ["de", "Laden im App Store", "4f2967e1f642dd16eec36ac4022f07b7a881cab6301a13be3a4ccfcd3206a614"],
  en: [null, "Download on the App Store", "a26fc5b38380272c92e9019a2eb8b45542a66814b3e2b203772db8904b9fb99f"],
  es: ["es", "Consíguelo en el App Store", "e4d7c2c1606454536482735c96b933b04ea86a2e72701b3319ae1f3a369b0479"],
  fr: ["fr", "Télécharger dans l’App Store", "86b6a05f6c8ac9e9a0637edf4f15420d06c8c7bc69662792a46793c1f948b023"],
  hi: [null, "Download on the App Store", "a26fc5b38380272c92e9019a2eb8b45542a66814b3e2b203772db8904b9fb99f"],
  id: ["id", "Download di App Store", "0f5069399be948e78b0d3087c9399fea9db4634182ac9dbf9fb88cf49c9c5d42"],
  it: ["it", "Scarica su App Store", "ec8e9566058da3382fc0c8b8a8532a342e3587be801fee42e110f8fd707cee0b"],
  ja: ["ja", "App Storeからダウンロード", "988fe0a48015c5a56dac88172487a1f5cda96340b34d80fd94312d02e9f67865"],
  ko: ["ko", "App Store에서 다운로드 하기", "fc82d5344d0f2919a7ae697e677fc9c62872f1ee47bd70e24a581245423de9c1"],
  pl: ["pl", "Pobierz w App Store", "da8b2cc13afd456e9000a8d2d061eee9c505bd6c8e66de1b40c02c2570fb1442"],
  pt: ["pt", "Baixar na App Store", "0e9291a9c654e479762b75b51dd94a150af6fab76390a79cb2218cdc8f6cc893"],
  ro: ["ro", "Descărcați de pe App Store", "18b0e4aa1e8678befe4e7db06e054447b9f96684d817b6424a6b8824042a45fb"],
  ru: ["ru", "Загрузите в App Store", "27f35c64f2a984ecb4546982889d5514a46666b7aba55909d052e4036862e725"],
  th: ["th", "ดาวน์โหลดได้ที่ App Store", "bd27f5219c96a0810445aeded8de847ad2bc73000d0f5b2f3b116451fff2f2e7"],
  tr: ["tr", "App Store’dan İndirin", "b85100fb20198a13c50a056f49ba2889d0510ac4a40e54cd3e19a578299e0170"],
  uk: ["uk", "Завантажити в App Store", "8d61d7a9071d060f63e6391e033e47e7347ff6e93d144f1b90dff856d6dc9c57"],
  vi: ["vi", "Tải về trên App Store", "2389eefe10dfd8fbe777ef22814458620e88d23a25696159272aca23c70ebbc3"],
  "zh-CN": ["zh-CN", "App Store 下载", "65191b2d1182a194e510b27c9985b1367b60ed6ef565f86fc492f585a27bc932"],
  "zh-TW": ["zh-TW", "App Store 下載", "0371becc5be192db830e225aabc55ee94d270c0810e453fd40842a12f24d8e80"],
};
const appleBadge = (lang) => `assets/app-store-badge${APPLE_BADGES[lang][0] ? `-${APPLE_BADGES[lang][0]}` : ""}.svg`;
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

test("every page quotes its language's app labels verbatim and links both stores with their badges", () => {
  for (const page of LANDINGS) {
    for (const lang of LANGUAGES) {
      const path = `${page}/${fileOf(lang)}`;
      const json = strings(lang);
      const words = text(path);
      for (const key of LABELS[page]) assert.ok(words.includes(json.labels[key]), `${path}: ${key} “${json.labels[key]}”`);
      // iOS is out (2026-10): no sentence saying it is not.
      assert.equal(json.common.appStore, undefined, `${lang}: no "not on the App Store yet" sentence`);
      assert.doesNotMatch(read(path), /class="soon"/, `${path}: no box that looks like a button`);
      assert.ok(words.includes(json.common.fragment), `${path}: what the browser keeps to itself`);
      assert.ok(words.includes(json[page].h1), `${path}: its heading`);
      const linksTo = (url) => [...read(path).matchAll(new RegExp(`<a\\s[^>]*href="${escape(url)}"[^>]*>([\\s\\S]*?)</a>`, "g"))];
      const play = linksTo(PLAY);
      assert.equal(play.length, 1, `${path}: Google Play`);
      assert.match(play[0][0], /\starget="_blank" rel="noopener"/, `${path}: in a new tab`);
      assert.match(play[0][1], /<img src="\/assets\/google-play-badge\.svg" alt="Get it on Google Play" width="189" height="56">/, `${path}: Google's badge`);
      const apple = linksTo(APP_STORE);
      assert.equal(apple.length, 1, `${path}: the App Store`);
      assert.match(apple[0][0], /\starget="_blank" rel="noopener"/, `${path}: in a new tab`);
      assert.match(apple[0][1], new RegExp(`<img src="/${escape(appleBadge(lang))}" alt="${escape(APPLE_BADGES[lang][1])}" width="\\d+" height="56">`), `${path}: Apple's badge in its language`);
      // Step 1 ends with the badges, the App Store first (Apple's guidelines).
      assert.match(read(path), /<div class="get">\s*<a class="apple"[^>]*>[^]*?<\/a>\s*<a class="play"[^>]*>[^]*?<\/a>\s*<\/div>\s*<\/li>/, `${path}: the badges close step 1`);
      assert.doesNotMatch(read(path), /\{[\w.]+\}/, `${path}: no placeholder left`);
    }
  }
});

test("Apple's badge in each language is Apple's file, unaltered, and its width keeps its shape", () => {
  for (const lang of LANGUAGES) {
    const file = join(site, appleBadge(lang));
    assert.ok(existsSync(file), `${lang}: ${appleBadge(lang)} exists`);
    const svg = readFileSync(file);
    assert.equal(createHash("sha256").update(svg).digest("hex"), APPLE_BADGES[lang][2], `${lang}: byte for byte Apple's file`);
    const [, , w, h] = svg.toString("utf8").match(/viewBox="([^"]+)"/)[1].trim().split(/\s+/).map(Number);
    const width = read(`add/${fileOf(lang)}`).match(new RegExp(`<img src="/${escape(appleBadge(lang))}" alt="[^"]*" width="(\\d+)"`))?.[1];
    assert.equal(Number(width), Math.round((56 * w) / h), `${lang}: width for a 56px-high badge`);
  }
  // Nothing else of Apple's in the assets: one file per badge used.
  const used = new Set(LANGUAGES.map(appleBadge));
  for (const f of readdirSync(join(site, "assets")).filter((f) => f.startsWith("app-store-badge"))) {
    assert.ok(used.has(`assets/${f}`), `assets/${f} is used`);
  }
});

// Review on an iPhone (2026-10-04): after a full-width "。", a space shows as a double gap. Step
// titles that end in full-width punctuation run straight into the step; the rest keep one space.
test("a step title is followed by one space, or by none after full-width punctuation", () => {
  for (const page of LANDINGS) {
    for (const lang of LANGUAGES) {
      const path = `${page}/${fileOf(lang)}`;
      for (const [, title, gap] of read(path).matchAll(/<strong>([^<]*)<\/strong>(\s*)/g)) {
        const fullWidth = /[。！？]$/.test(title);
        assert.equal(gap, fullWidth ? "" : " ", `${path}: after “${title}”`);
      }
    }
  }
  assert.match(read("add/ja.html"), /<strong>FlickerTalkを入手します。<\/strong>すでに/, "ja: no gap");
  assert.match(read("add/zh-TW.html"), /<strong>取得 FlickerTalk。<\/strong>如果/, "zh-TW: no gap");
});

// Tablet review (2026-10-04): WebKit with word-break: keep-all breaks after an opening quote before
// Hangul, leaving "‘" alone at the end of a line. In Korean, the quote and the first word of the
// label it opens never wrap apart (only the first word: a whole label could be wider than a phone).
test("in Korean, an opening quote stays on the line of its label's first word", () => {
  for (const page of LANDINGS) {
    const path = `${page}/ko.html`;
    const main = read(path).match(/<main[\s\S]*<\/main>/)[0];
    const quoted = [...JSON.stringify(strings("ko")[page]).matchAll(/‘\{([\w.]+)\}/g)].map(([, key]) => strings("ko").labels[key]);
    assert.ok(quoted.length >= 4, `${path}: quoted labels`);
    for (const label of quoted) {
      const [first, ...rest] = label.split(" ");
      const tail = rest.length ? " " + rest.join(" ") : "";
      assert.ok(main.includes(`<span class="nobr">‘${first}</span>${tail}’`), `${path}: ‘${label}’`);
    }
    assert.equal((main.match(/‘/g) ?? []).length, (main.match(/<span class="nobr">‘/g) ?? []).length, `${path}: every opening quote`);
  }
  for (const lang of LANGUAGES.filter((l) => l !== "ko")) {
    for (const page of LANDINGS) assert.doesNotMatch(read(`${page}/${fileOf(lang)}`), /class="nobr"/, `${page}/${fileOf(lang)}: Korean only`);
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
