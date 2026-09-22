// The landing is static HTML with no scripts and nothing from other sites (Plan §77), and its
// privacy claims must be exactly as precise as §70 and §78 allow.
import { test } from "node:test";
import assert from "node:assert/strict";
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
  "terms/index.html",
  "404.html",
];

const read = (path) => readFileSync(join(site, path), "utf8");
const text = (path) => read(path).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
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

test("every page reaches the privacy policy, the terms and the contact address", () => {
  for (const page of PAGES) {
    const html = read(page);
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
  ]) {
    assert.ok(!all.includes(claim), `nobody may read "${claim}"`);
  }
});

// §40: the price is announced from the launch, on the landing and in the terms.
test("the price is on the home page and in the terms", () => {
  for (const page of ["index.html", "terms/index.html"]) {
    const words = text(page);
    assert.match(words, /first year/i, `${page}: first year free`);
    assert.match(words, /€1 (per|a) year/i, `${page}: €1 a year`);
    assert.match(words, /under 18/i, `${page}: free under 18`);
  }
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
