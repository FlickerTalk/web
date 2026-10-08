// The files that let a contact link (https://flickertalk.com/add#…) or a move link (/move#…) open
// the app instead of the browser: Android App Links read /.well-known/assetlinks.json, iOS
// Universal Links read /.well-known/apple-app-site-association. Both are static files in
// site/.well-known/, served as they are. The Apple team ID in the second one is public by design
// (it is in every iOS app bundle and in every app's apple-app-site-association), not a secret.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

const PACKAGE = "com.flickertalk.app";
const BUNDLE = "com.flickertalk.app";
const TEAM = "3TSPDYY333";
const AASA = "site/.well-known/apple-app-site-association";
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
// The upload key, read from the signed APK of the 1.4.1 release.
const UPLOAD_KEY = "97:C2:84:62:4C:46:71:05:81:FB:63:E5:1F:E0:2C:CB:42:AF:06:EA:73:35:C5:20:98:29:51:CA:E9:7E:0F:6B";
// Play's app signing key (Play Console → App signing), the one on every install from Google Play.
const PLAY_KEY = "D2:08:CB:64:1F:C6:26:B1:49:9F:8A:85:9E:33:65:2B:DD:36:94:A3:63:49:38:EE:9B:1C:D7:40:2A:29:E0:5B";
const LINK_PATHS = ["/add", "/move"];

test("assetlinks.json lets the app handle the links, signed with a known key", () => {
  const statements = JSON.parse(read("site/.well-known/assetlinks.json"));
  assert.ok(Array.isArray(statements));
  assert.equal(statements.length, 1, "one statement, for the app");
  const [statement] = statements;
  assert.deepEqual(statement.relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(statement.target.namespace, "android_app");
  assert.equal(statement.target.package_name, PACKAGE);
  const prints = statement.target.sha256_cert_fingerprints;
  assert.ok(Array.isArray(prints) && prints.length >= 1);
  for (const print of prints) assert.match(print, FINGERPRINT);
  assert.equal(new Set(prints).size, prints.length, "no fingerprint twice");
  assert.ok(prints.includes(UPLOAD_KEY), "the upload key, for builds installed outside Play");
  assert.ok(prints.includes(PLAY_KEY), "Play's signing key, for installs from Google Play");
});

test("apple-app-site-association is JSON that opens /add and /move in the app", () => {
  const aasa = JSON.parse(read(AASA));
  assert.deepEqual(Object.keys(aasa), ["applinks"]);
  assert.equal(aasa.applinks.details.length, 1);
  const [details] = aasa.applinks.details;
  assert.deepEqual(details.appIDs, [`${TEAM}.${BUNDLE}`]);
  assert.equal(details.paths, undefined, "components (iOS 15+), not the old paths");
  assert.deepEqual(details.components.map((component) => component["/"]), LINK_PATHS);
  for (const component of details.components) {
    assert.deepEqual(Object.keys(component).filter((key) => key !== "comment"), ["/"], "the fragment and the query do not matter");
  }
});

test("the image copies apple-app-site-association with site/, without a build secret", () => {
  assert.ok(!existsSync(join(root, "well-known")), "no template outside site/");
  const dockerfile = read("Dockerfile");
  assert.match(dockerfile, /^COPY site\/ \/usr\/share\/nginx\/html\/$/m);
  assert.doesNotMatch(dockerfile, /--mount=type=secret|apple_team_id/i);
});

test("the workflow builds without the team secret and checks both files are served", () => {
  const workflow = read(".github/workflows/web.yml");
  assert.doesNotMatch(workflow, /apple_team_id|^\s*secrets:\s*\|/im);
  for (const file of ["assetlinks.json", "apple-app-site-association"]) {
    assert.ok(workflow.includes(`/.well-known/${file}`), `the smoke test fetches ${file}`);
  }
  assert.ok(workflow.includes(`${TEAM}\\.com\\.flickertalk\\.app`), "the smoke test checks the served app ID");
});

test("the web server answers both files as JSON, as they are", () => {
  const conf = read("nginx.conf");
  for (const file of ["assetlinks.json", "apple-app-site-association"]) {
    const block = conf.match(new RegExp(`location = /\\.well-known/${file.replaceAll(".", "\\.")} \\{([^}]*\\{[^}]*\\}[^}]*|[^}]*)\\}`));
    assert.ok(block, `a location for ${file}`);
    assert.match(block[1], /default_type application\/json;/);
    assert.doesNotMatch(block[1], /add_header/, "an add_header here would drop the security headers");
    assert.doesNotMatch(block[1], /\b(return|rewrite|try_files)\b/);
  }
});
