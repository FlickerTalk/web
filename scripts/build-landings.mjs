// Writes the /add and /move landings (2026-10-04) in every language of landing/<lang>.json:
// site/<page>/index.html in English and site/<page>/<lang>.html for the rest. nginx picks one by
// the browser's first language (nginx.conf, $landing_lang). The pages are committed; run
// `npm run build-landings` after changing a string, and the tests check nothing drifted.
//
// In the copy, {key} is replaced by the app's own label for that key ("labels" in the same file),
// copied verbatim from app/src/i18n/<lang>.json, so the page names the buttons as the app does.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["add", "move"];
const RTL = new Set(["ar"]);

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Korean: WebKit with word-break: keep-all breaks after an opening quote before Hangul, so the
// quote and the first word of the label it opens go together in a span that does not wrap. Only
// the first word: a whole label could be wider than a phone.
const KEEP_QUOTE_WITH_WORD = new Set(["ko"]);

function fill(value, labels, where, lang) {
  const label = (key) => {
    if (!(key in labels)) throw new Error(`${where}: no label ${key}`);
    return labels[key];
  };
  let html = escape(value);
  if (KEEP_QUOTE_WITH_WORD.has(lang)) {
    html = html.replace(/‘\{([\w.]+)\}/g, (_, key) => {
      const [first, ...rest] = label(key).split(" ");
      return `<span class="nobr">‘${escape(first)}</span>${escape(rest.length ? " " + rest.join(" ") : "")}`;
    });
  }
  return html.replace(/\{([\w.]+)\}/g, (_, key) => escape(label(key)));
}

function page(lang, name, strings) {
  const t = (key) => fill(strings[name][key], strings.labels, `${lang} ${name}.${key}`, lang);
  const common = (key) => fill(strings.common[key], strings.labels, `${lang} common.${key}`, lang);
  // A step's title and its text: no space after full-width punctuation (ja, zh), where a space
  // shows as a double gap; one space otherwise (Thai separates phrases with a space, too).
  const step = (n) => {
    const title = t(`step${n}Title`);
    return `<strong>${title}</strong>${/[。！？]$/.test(title) ? "" : " "}${t(`step${n}`)}`;
  };
  // The header and footer lead to the English site.
  const english = lang === "en" ? "" : RTL.has(lang) ? ' lang="en" dir="ltr"' : ' lang="en"';
  return `<!doctype html>
<html lang="${lang}"${RTL.has(lang) ? ' dir="rtl"' : ""}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${t("title")} · FlickerTalk</title>
  <meta name="description" content="${t("description")}">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#e8731f">
  <link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
  <header class="wrap top"${english}>
    <a class="brand" href="/"><img src="/assets/mark.svg" alt="" width="26" height="26">FlickerTalk</a>
    <nav aria-label="Main">
        <a href="/how-it-works/">How it works</a>
        <a href="/security/">Security</a>
        <a href="/faq/">FAQ</a>
        <a href="https://github.com/FlickerTalk">Source code</a>
    </nav>
  </header>
  <main class="wrap">
    <section class="hero">
      <h1>${t("h1")}</h1>
      <p class="lead">${t("lead")}</p>
    </section>

    <h2>${t("h2")}</h2>
    <ol>
      <li>${step(1)}
        <div class="get">
          <a class="play" href="https://play.google.com/store/apps/details?id=com.flickertalk.app" target="_blank" rel="noopener"><img src="/assets/google-play-badge.svg" alt="Get it on Google Play" width="189" height="56"></a>
        </div>
        <p>${common("appStore")}</p>
      </li>
      <li>${step(2)}</li>
      <li>${step(3)}</li>
    </ol>
    <p>${common("fragment")}</p>
  </main>
  <footer class="wrap"${english}>
    <nav aria-label="Legal">
      <a href="/how-it-works/">How it works</a>
      <a href="/faq/">FAQ</a>
      <a href="/support/">Help &amp; contact</a>
      <a href="/privacy/">Privacy</a>
      <a href="/terms/">Terms</a>
      <a href="/transparency/">Transparency</a>
      <a href="/security/">Security</a>
      <a href="https://github.com/FlickerTalk">Source code</a>
    </nav>
    <p>FlickerTalk is a service of ERPLORA CLOUD SL, NIF B27593136.</p>
    <p>No cookies, analytics, trackers or access logs on this website.</p>
    <p>Contact: <a href="mailto:info@flickertalk.com">info@flickertalk.com</a></p>
    <p>Google Play and the Google Play logo are trademarks of Google LLC.</p>
  </footer>
</body>
</html>
`;
}

/** Every landing page, by its path under site/. */
export function build() {
  const pages = {};
  const languages = readdirSync(join(root, "landing")).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  for (const lang of languages) {
    const strings = JSON.parse(readFileSync(join(root, "landing", `${lang}.json`), "utf8"));
    for (const name of PAGES) pages[`${name}/${lang === "en" ? "index" : lang}.html`] = page(lang, name, strings);
  }
  return pages;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [path, html] of Object.entries(build())) writeFileSync(join(root, "site", path), html);
}
