// The files that let a contact link (https://flickertalk.com/add#…) or a move link (/move#…) open
// the app instead of the browser: Android App Links read /.well-known/assetlinks.json, iOS
// Universal Links read /.well-known/apple-app-site-association. The second one names the Apple
// team, which never goes into this public repo: the image fills it in from a build secret.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

const PACKAGE = "com.flickertalk.app";
const BUNDLE = "com.flickertalk.app";
const PLACEHOLDER = "__APPLE_TEAM_ID__";
const TEMPLATE = "well-known/apple-app-site-association.template";
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
// The upload key, read from the signed APK of the 1.4.1 release.
const UPLOAD_KEY = "97:C2:84:62:4C:46:71:05:81:FB:63:E5:1F:E0:2C:CB:42:AF:06:EA:73:35:C5:20:98:29:51:CA:E9:7E:0F:6B";
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
});

test("the apple-app-site-association template is outside site/ and has the team as a placeholder", () => {
  assert.ok(existsSync(join(root, TEMPLATE)));
  assert.ok(!existsSync(join(root, "site/.well-known/apple-app-site-association")), "generated when the image is built");
  assert.ok(read(TEMPLATE).includes(`${PLACEHOLDER}.${BUNDLE}`));
});

test("the filled-in template is JSON that opens /add and /move in the app", () => {
  const team = ["Z", "Z", "Z", "Z", "Z", "9", "9", "9", "9", "9"].join("");
  const aasa = JSON.parse(read(TEMPLATE).replaceAll(PLACEHOLDER, team));
  assert.deepEqual(Object.keys(aasa), ["applinks"]);
  assert.equal(aasa.applinks.details.length, 1);
  const [details] = aasa.applinks.details;
  assert.deepEqual(details.appIDs, [`${team}.${BUNDLE}`]);
  assert.equal(details.paths, undefined, "components (iOS 15+), not the old paths");
  assert.deepEqual(details.components.map((component) => component["/"]), LINK_PATHS);
  for (const component of details.components) {
    assert.deepEqual(Object.keys(component).filter((key) => key !== "comment"), ["/"], "the fragment and the query do not matter");
  }
});

// The team ID is public once served, but it is not written into this repo (Plan, links design).
test("no file in the repo names an Apple team next to the bundle", () => {
  const skip = new Set([".git", "node_modules", "dist"]);
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(path);
    }
  };
  walk(root);
  const team = new RegExp(`[A-Z0-9]{10}\\.${BUNDLE.replaceAll(".", "\\.")}`);
  for (const file of files) {
    assert.doesNotMatch(readFileSync(file, "latin1"), team, relative(root, file));
  }
});

test("the image fills in the team from a build secret and refuses to build without one", () => {
  const dockerfile = read("Dockerfile");
  assert.match(dockerfile, /--mount=type=secret,id=apple_team_id\b/);
  assert.match(dockerfile, /--mount=type=bind,source=well-known,/, "the template is read, not copied into the image");
  assert.ok(dockerfile.includes(PLACEHOLDER));
  assert.ok(dockerfile.includes("/usr/share/nginx/html/.well-known/apple-app-site-association"));
  assert.match(dockerfile, /exit 1/);
  assert.doesNotMatch(dockerfile, /ARG\s+APPLE_TEAM_ID/, "a build argument would stay in the image history");
});

test("the workflow passes the team as a secret and checks both files are served", () => {
  const workflow = read(".github/workflows/web.yml");
  assert.match(workflow, /secrets:\s*\|?\s*\n?\s*apple_team_id=\$\{\{ secrets\.APPLE_TEAM_ID \}\}/);
  for (const file of ["assetlinks.json", "apple-app-site-association"]) {
    assert.ok(workflow.includes(`/.well-known/${file}`), `the smoke test fetches ${file}`);
  }
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
