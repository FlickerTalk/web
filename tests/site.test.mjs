// The landing is static HTML with no scripts and nothing from other sites (Plan §77), and its
// privacy claims must be exactly as precise as §70 and §78 allow.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");

const PAGES = [
  "index.html",
  "how-it-works/index.html",
  "security/index.html",
  "faq/index.html",
  "transparency/index.html",
  "privacy/index.html",
  "delete-data/index.html",
  "terms/index.html",
  "support/index.html",
  "404.html",
];

const read = (path) => readFileSync(join(site, path), "utf8");
const text = (path) => read(path).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const everything = () => PAGES.map(text).join(" ");

test("every page exists, in English, with a title and a description", () => {
  for (const page of PAGES) {
    assert.ok(existsSync(join(site, page)), `${page} exists`);
    const html = read(page);
    assert.match(html, /<html lang="en">/, `${page} is in English`);
    assert.match(html, /<title>[^<]+<\/title>/, `${page} has a title`);
    assert.match(html, /<meta name="viewport"/, `${page} fits a phone`);
    assert.match(html, /<meta name="description" content="[^"]+"/, `${page} has a description`);
  }
});

test("no scripts, no inline styles and nothing loaded from another site", () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.doesNotMatch(html, /<script/i, `${page} has no scripts`);
    assert.doesNotMatch(html, /<style|\sstyle="/i, `${page} has no inline styles (the CSP forbids them)`);
    assert.doesNotMatch(html, /\s(src|srcset)="(https?:)?\/\//i, `${page} loads nothing from another site`);
    assert.doesNotMatch(html, /<link[^>]+href="(https?:)?\/\//i, `${page} links no outside stylesheet or icon`);
  }
  const css = read("assets/style.css");
  assert.doesNotMatch(css, /@import|url\(\s*["']?(https?:)?\/\//i, "the stylesheet pulls nothing from outside");
});

test("every internal link points to a file that exists", () => {
  for (const page of PAGES) {
    for (const [, target] of read(page).matchAll(/\s(?:href|src)="(\/[^"#?]*)/g)) {
      const file = target.endsWith("/") ? join(target, "index.html") : target;
      assert.ok(existsSync(join(site, file)), `${page} → ${target}`);
    }
  }
});

test("every page reaches the privacy policy, the terms, help and the contact address", () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.match(html, /href="\/support\/"/, `${page} links help & contact`);
    assert.match(html, /href="\/privacy\/"/, `${page} links the privacy policy`);
    assert.match(html, /href="\/terms\/"/, `${page} links the terms`);
    assert.match(html, /mailto:info@flickertalk\.com/, `${page} shows the contact address`);
  }
});

// §70, §78: claims we cannot make.
test("no privacy claim the design cannot keep", () => {
  const all = everything().toLowerCase();
  for (const claim of [
    "does not process any data",
    "doesn't process any data",
    "no data at all",
    "never sees your ip",
    "never sees an ip",
    "does not store messages",
    "doesn't store messages",
    "never stores messages",
    "100% anonymous",
    "military-grade",
    // The key does leave the phone once, to the user's new phone (§60); mail waits on our server.
    "never leaves",
    "we store nothing",
    "we know nothing",
    "no data to hand over",
    // Not in the MVP (§85).
    "voice note",
    // No promise of support we do not run.
    "we will answer",
  ]) {
    assert.ok(!all.includes(claim), `nobody may read "${claim}"`);
  }
});

// §40: the price is announced from the launch, on the landing and in the terms.
test("the price is on the home page and in the terms", () => {
  for (const page of ["index.html", "terms/index.html"]) {
    const words = text(page);
    assert.match(words, /first year/i, `${page}: first year free`);
    assert.match(words, /€0\.99 (per|a) year/i, `${page}: €0.99 a year`);
    assert.match(words, /under 21/i, `${page}: free under 21 (§40, 2026-09-22)`);
    assert.match(words, /€0\.99 a year for users aged 21 and over/i, `${page}: €0.99 for users aged 21 and over`);
    assert.doesNotMatch(words, /under 18|for adults/i, `${page}: the old age rule is gone`);
  }
});

// §40, 2026-09-29: the price is €0.99, because Google Play does not accept exactly €1.00.
test("no page still states the old price of €1", () => {
  for (const page of PAGES) {
    assert.doesNotMatch(read(page), /€ ?1(?![.,]?\d)|1 ?€|one euro/i, `${page}: the old €1 price`);
  }
});

test("the terms say the store sets the local price", () => {
  const words = text("terms/index.html");
  assert.match(words, /app store sets the price/i, "terms: the store sets the price");
  assert.match(words, /country and currency/i, "terms: it may vary by country and currency");
});

// §67–69, §99: the limits of the model are documented.
test("the limits of peer to peer and push are explained", () => {
  const words = text("how-it-works/index.html");
  assert.match(words, /IP address/i);
  assert.match(words, /Google/);
  assert.match(words, /Apple/);
  assert.match(words, /relay/i);
});

test("the privacy policy names who is responsible and what is kept, and for how long", () => {
  const words = text("privacy/index.html");
  for (const fact of [
    "ERPLORA CLOUD SL",
    "B27593136",
    "Coslada",
    "AEPD",
    "7 days",
    "Hetzner",
    "Firebase Cloud Messaging",
    "Erase this phone",
    "info@flickertalk.com",
  ]) {
    assert.ok(words.includes(fact), `the policy mentions ${fact}`);
  }
});

test("the terms say there is no warranty and that use is at the user's own risk", () => {
  const words = text("terms/index.html");
  assert.match(words, /as is/i);
  assert.match(words, /without warrant/i);
  assert.match(words, /own risk/i);
  assert.match(words, /ERPLORA CLOUD SL/);
});

// Two colours only: black and white, with greys in between.
test("the stylesheet is black and white", () => {
  const css = readFileSync(join(site, "assets/style.css"), "utf8");
  for (const [hex, value] of css.matchAll(/#([0-9a-f]{3,8})\b/gi)) {
    const full = value.length <= 4 ? [...value].map((c) => c + c).join("") : value;
    const [r, g, b] = [0, 2, 4].map((i) => full.slice(i, i + 2));
    assert.ok(r === g && g === b, `${hex} is not a grey`);
  }
  for (const [colour, channels] of css.matchAll(/rgba?\(([^)]+)\)/gi)) {
    const [r, g, b] = channels.split(/[\s,/]+/).filter(Boolean).slice(0, 3);
    assert.ok(r === g && g === b, `${colour} is not a grey`);
  }
});

// §71: no access logs anywhere; the headers keep the page to itself.
test("the web server keeps no access log and sends a strict policy", () => {
  const conf = readFileSync(join(root, "nginx.conf"), "utf8");
  assert.match(conf, /access_log\s+off;/);
  assert.doesNotMatch(conf, /access_log\s+(?!off)/);
  // A 404 would write the client's IP to the error log.
  assert.match(conf, /log_not_found\s+off;/);
  assert.match(conf, /error_log\s+\S+\s+crit;/);
  assert.match(conf, /Content-Security-Policy "default-src 'none';[^"]*style-src 'self'/);
  assert.match(conf, /frame-ancestors 'none'/);
  assert.match(conf, /Referrer-Policy "no-referrer"/);
});

// Privacy first: no activity logs is the promise of the home page, and it is precise about it.
test("the home page leads with privacy and no activity logs", () => {
  const html = read("index.html");
  assert.match(html, /<title>[^<]*No activity logs[^<]*<\/title>/);
  const words = text("index.html");
  assert.match(words, /Your conversations are yours/);
  assert.match(words, /No activity logs/);
  assert.match(words, /7 days/);
  assert.match(words, /install only the ones you want/i, "the tools are installed, not built in (§56)");
  assert.match(words, /without network access/i);
});

test("the FAQ says what the server does keep", () => {
  const words = text("faq/index.html");
  assert.match(words, /Does that mean your servers store nothing\?/);
  assert.match(words, /hash of your routing code/);
  assert.match(words, /never through our servers/, "moving phones never goes through us (§60)");
});

test("transparency lists the routing hash with the rest of what we have", () => {
  assert.match(text("transparency/index.html"), /routing code/);
});

test("the privacy policy says what stays on the device, not what never leaves it", () => {
  const words = text("privacy/index.html");
  assert.match(words, /What stays on your device/);
  assert.match(words, /under 21/);
  assert.match(words, /under 14/, "the age of consent does not follow the price");
});

test("help & contact is honest about what we cannot do", () => {
  const words = text("support/index.html");
  for (const fact of [
    "Help & contact",
    "activity logs",
    "Move to a new phone",
    "Erase this phone",
    "Report a vulnerability",
    "info@flickertalk.com",
    "ERPLORA CLOUD SL",
    "B27593136",
  ]) {
    assert.ok(words.includes(fact), `the help page mentions ${fact}`);
  }
  assert.match(words, /Android or iOS/, "the help page does not assume one platform");
});

// Android is out (2026-10-01): the home page sends people to Google Play; iOS is still on its way.
const PLAY = "https://play.google.com/store/apps/details?id=com.flickertalk.app";
const BADGE = "assets/google-play-badge.svg";
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const playLinks = (html) => [...html.matchAll(new RegExp(`<a\\s[^>]*href="${escape(PLAY)}"[^>]*>([\\s\\S]*?)</a>`, "g"))];

test("the home page links the Google Play listing with the official badge, twice", () => {
  const links = playLinks(read("index.html"));
  assert.equal(links.length, 2, "the hero and the closing section both link Google Play");
  for (const [link, inner] of links) {
    assert.match(link, /\starget="_blank"/, "the store opens in a new tab");
    assert.match(link, /\srel="noopener"/, "and cannot reach back into the page");
    assert.match(inner, new RegExp(`<img src="/${escape(BADGE)}" alt="Get it on Google Play"`), "the badge, with its alt text");
  }
});

// Google's artwork, as Google ships it ("Get it on Google Play", English, digital SVG): the badge
// guidelines forbid altering it, so the bytes are pinned.
test("the badge is Google's English SVG, unaltered and served from this site", () => {
  const file = join(site, BADGE);
  assert.ok(existsSync(file), `${BADGE} exists`);
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
  assert.equal(hash, "4ffa4c7edd2f10b297ca4de2131eddaa00d03b2278d1e178fe512920d824ca34", "the badge is byte for byte Google's file");
});

test("no page still says the app is coming to both platforms", () => {
  for (const page of PAGES) {
    assert.doesNotMatch(text(page), /Coming soon to iOS and Android/i, `${page}: Android is out`);
  }
});

test("iOS is still marked as coming soon", () => {
  assert.equal(text("index.html").match(/Coming soon on the App Store/g)?.length, 2, "next to both badges");
});

test("the FAQ and help pages say where to get the app", () => {
  for (const page of ["faq/index.html", "support/index.html"]) {
    assert.equal(playLinks(read(page)).length, 1, `${page} links Google Play`);
    assert.match(text(page), /App Store/, `${page}: iOS is coming`);
  }
});

// Links out are few and known: the source code, the Spanish regulator and the store listing.
test("every link to another site is one we know", () => {
  const known = [/^https:\/\/github\.com\/FlickerTalk(\/[\w/-]*)?$/, /^https:\/\/www\.aepd\.es$/, new RegExp(`^${escape(PLAY)}$`)];
  for (const page of PAGES) {
    for (const [, url] of read(page).matchAll(/\shref="((?:https?:)?\/\/[^"]*)"/gi)) {
      assert.ok(known.some((k) => k.test(url)), `${page} → ${url}`);
    }
  }
});
