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
  // Games (2026-10-02, plan of the games 10.6): where an invite link lands. Not linked from the
  // home page or the FAQ until the games are published.
  "games/index.html",
  "games/tictactoe/index.html",
  "games/fourinarow/index.html",
  "games/chess/index.html",
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

// Circles (app, 2026-09-27): small closed groups of contacts are in the app on Google Play, so no
// page may still say FlickerTalk is one to one only, and the pages say what circles do and do not.
test("no page still says FlickerTalk is one to one only", () => {
  for (const page of PAGES) {
    const words = text(page);
    assert.doesNotMatch(words, /Are there group chats\? No/i, `${page}: circles exist`);
    assert.doesNotMatch(words, /designed for one-to-one conversations/i, `${page}: circles exist`);
    assert.doesNotMatch(words, /built for conversations between two people/i, `${page}: circles exist`);
    assert.doesNotMatch(words, /lets two people exchange/i, `${page}: circles exist`);
    assert.doesNotMatch(read(page), /<li>One-to-one conversations\.<\/li>/, `${page}: circles exist`);
  }
});

test("the home page shows circles as part of the app, for text", () => {
  const words = text("index.html");
  assert.match(words, /start a circle: a small, closed group of your contacts, up to 32 members/i);
  assert.match(words, /circles are for text messages only/i, "no files or calls in a circle");
  assert.match(words, /keeps no record of circles/i, "the server is not told a circle exists");
});

test("the FAQ says what circles are, what they are not, and what members learn", () => {
  const words = text("faq/index.html");
  assert.match(words, /Are there group chats\? Yes, small ones, called circles/);
  assert.match(words, /up to 32 members, you included/, "the limit counts the creator too");
  assert.match(words, /nobody can join on their own/i);
  assert.match(words, /only admins write/i, "the one-to-many switch");
  assert.match(words, /There are no calls or file sharing in a circle, no read receipts/);
  assert.match(words, /joins later does not see what was said before/);
  assert.match(words, /keeps no record of circles/);
  assert.match(words, /What do other members of a circle learn about me\?/);
  assert.match(words, /arrives as a request/);
  assert.match(words, /members of a circle you are in/i, "circle members may see your IP address too");
});

test("how it works explains circles and what their members can see", () => {
  const words = text("how-it-works/index.html");
  assert.match(words, /In a circle/);
  assert.match(words, /cannot tell apart from one-to-one messages/);
  assert.match(words, /Members of a circle/);
  assert.match(words, /no circles/, "the server keeps no list of circles");
});

test("the privacy policy says what members of a circle receive about you", () => {
  const words = text("privacy/index.html");
  assert.match(words, /every member of the circle receives your contact card/i);
  assert.match(words, /arrives as a request/);
  assert.match(words, /public IP address/);
  assert.match(words, /keep no record of circles/);
});

test("the terms describe circles", () => {
  const words = text("terms/index.html");
  assert.match(words, /called a circle/);
  assert.match(words, /its admins decide who is in it/);
});

test("transparency says we do not have circles or their members", () => {
  assert.match(text("transparency/index.html"), /circles or their members/i);
});

// Games (2026-10-02, plan of the games 10.6): the app invites with https://flickertalk.com/games/<name>,
// where <name> is the last part of the game's id (com.flickertalk.game.<name>). Whoever opens it
// without the app, or with an older one, lands on a page that says what the game is and where it
// is played. /games/ lists them all.
const GAMES = { tictactoe: "Tic-Tac-Toe", fourinarow: "Four in a Row", chess: "Chess" };

test("the games index links every game, and every game page links back", () => {
  const index = read("games/index.html");
  assert.match(index, /href="\/"/, "the index links the home page");
  for (const [name, title] of Object.entries(GAMES)) {
    assert.match(index, new RegExp(`href="/games/${name}/"`), `the index links ${name}`);
    assert.ok(text("games/index.html").includes(title), `the index names ${title}`);
    const page = read(`games/${name}/index.html`);
    assert.match(page, /href="\/"/, `${name} links the home page`);
    assert.match(page, /href="\/games\/"/, `${name} links the games index`);
  }
});

test("a game page says what the game is, where it is played and what it keeps", () => {
  for (const [name, title] of Object.entries(GAMES)) {
    const html = read(`games/${name}/index.html`);
    const words = text(`games/${name}/index.html`);
    assert.match(html, new RegExp(`<title>${escape(title)} · FlickerTalk</title>`), `${name}: its title`);
    assert.match(html, new RegExp(`<h1>${escape(title)}</h1>`), `${name}: its name`);
    assert.match(words, /Games tab/, `${name}: opened from the Games tab`);
    assert.match(words, /🎮/, `${name}: or the 🎮 button in a chat`);
    assert.match(words, /1\.3\.0 or newer/, `${name}: the app that has games`);
    assert.match(words, /Android/, `${name}: on Android for now`);
    assert.match(words, /Games are available on Android for now/, `${name}: on Android for now`);
    // Nothing promised that is not there, and no one else's trademark.
    assert.doesNotMatch(words, /iPhone|iOS|App Store/, `${name}: no promise for the iPhone yet`);
    assert.doesNotMatch(words, /dice/i, `${name}: no dice`);
    assert.doesNotMatch(words, /connect ?(4|four)/i, `${name}: not a trademark`);
  }
});

// §70, §78: precise about what a match keeps and where, and about the relay (named as
// how-it-works names it), on every games page.
test("the games pages say what a match keeps, and that the relay cannot read it", () => {
  for (const page of ["games/index.html", ...Object.keys(GAMES).map((name) => `games/${name}/index.html`)]) {
    assert.ok(
      text(page).includes(
        "Matches travel end-to-end encrypted between the two phones, over the same connection as your chat, and are saved only on them. If that connection has to go through our relay, the relay carries the encrypted data and cannot read it."
      ),
      `${page}: what a match keeps, and where`
    );
  }
});

test("the games are not announced before they are published", () => {
  for (const page of ["index.html", "faq/index.html"]) {
    assert.doesNotMatch(read(page), /href="\/games\//, `${page} does not link the games yet`);
  }
});
