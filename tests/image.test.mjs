import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { request } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_DIR = "/var/lib/ft-downloads";
const BROWSER = "Mozilla/5.0 (FlickerTalk image test)";
const KEY = /^\d{4}-\d{2}\|com\.flickertalk\.[a-z0-9.-]+\|[0-9A-Za-z.+-]+\|(app|other)$/;

const dockerWorks = spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
const skip = dockerWorks ? false : "Docker is not available here, so the image was not built or run";

const suffix = `${process.pid}-${Date.now()}`;
const image = `ft-web-downloads-test:${suffix}`;
const volume = `ft-web-downloads-test-${suffix}`;
const containers = [];
const volumes = [volume];

const docker = (...args) => execFileSync("docker", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const catalogue = JSON.parse(readFileSync(join(root, "site/plugins/catalogue.json"), "utf8")).plugins;
const plugin = catalogue[0];
const packagePath = new URL(plugin.url).pathname;

const fetchRaw = (port, path, { method = "GET", headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method, headers, agent: false }, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.on("error", reject);
    req.end();
  });

const start = (name, { withVolume = true, volumeName = volume, hostname, env = [] } = {}) => {
  const args = ["run", "-d", "--name", name, "-p", "127.0.0.1::8080"];
  if (hostname) args.push("--hostname", hostname);
  if (withVolume) args.push("-v", `${volumeName}:${STATE_DIR}`);
  for (const pair of env) args.push("-e", pair);
  docker(...args, image);
  containers.push(name);
  return Number(docker("port", name, "8080/tcp").split(":").pop());
};

const ready = async (port) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetchRaw(port, "/version.txt")).status === 200) return;
    } catch {}
    await sleep(200);
  }
  throw new Error("the container did not start serving");
};

const stateFile = (container, hostname) => {
  const read = spawnSync("docker", ["exec", container, "cat", `${STATE_DIR}/${hostname}.json`], { encoding: "utf8" });
  return read.status === 0 ? read.stdout : null;
};

const totals = (raw) => Object.fromEntries(Object.entries(JSON.parse(raw)).map(([key, entry]) => [key, entry.value]));

const waitForTotals = async (container, hostname, expected) => {
  let last = null;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const raw = stateFile(container, hostname);
    if (raw) {
      last = totals(raw);
      if (isDeepStrictEqual(last, expected)) return raw;
    }
    await sleep(200);
  }
  assert.deepEqual(last, expected);
};

const month = () => new Date().toISOString().slice(0, 7);
const keyOf = (client) => `${month()}|${plugin.id}|${plugin.version}|${client}`;

describe("the image counts package downloads", { skip }, () => {
  let port;
  let first;

  before(
    async () => {
      docker("build", "-q", "-t", image, ".");
      docker("volume", "create", volume);
      first = `ft-web-downloads-test-a-${suffix}`;
      port = start(first, { hostname: "web-1", env: ["uri=broken", "landing_lang=broken"] });
      await ready(port);
    },
    { timeout: 600_000 },
  );

  after(() => {
    for (const name of containers) spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
    for (const name of volumes) spawnSync("docker", ["volume", "rm", "-f", name], { stdio: "ignore" });
    spawnSync("docker", ["image", "rm", "-f", image], { stdio: "ignore" });
  });

  test("two app downloads and one from a browser, and nothing else", async () => {
    const plain = await fetchRaw(port, packagePath);
    assert.equal(plain.status, 200);
    assert.equal((await fetchRaw(port, packagePath)).status, 200);
    assert.equal((await fetchRaw(port, packagePath, { headers: { "User-Agent": BROWSER } })).status, 200);
    assert.equal((await fetchRaw(port, packagePath, { method: "HEAD" })).status, 200);
    assert.equal((await fetchRaw(port, packagePath, { headers: { Range: "bytes=0-9" } })).status, 206);
    assert.equal((await fetchRaw(port, packagePath, { headers: { "If-None-Match": plain.headers.etag } })).status, 304);
    assert.equal((await fetchRaw(port, `/plugins/${plugin.id}/0.0.0.ftplugin`)).status, 404);
    assert.equal((await fetchRaw(port, "/plugins/catalogue.json")).status, 200);
    assert.equal((await fetchRaw(port, "/privacy/")).status, 200);
    await waitForTotals(first, "web-1", { [keyOf("app")]: 2, [keyOf("other")]: 1 });
  });

  test("the state file holds totals and nothing about the requests", () => {
    const raw = stateFile(first, "web-1");
    assert.doesNotMatch(raw, /Mozilla|127\.0\.0\.1|172\.\d+\.|::1/);
    for (const [key, entry] of Object.entries(JSON.parse(raw))) {
      assert.match(key, KEY);
      assert.deepEqual(Object.keys(entry), ["value"]);
    }
    assert.deepEqual(docker("exec", first, "ls", "-A", STATE_DIR).split("\n"), ["web-1.json"]);
  });

  test("the server writes no log line and no log file", () => {
    const logs = spawnSync("docker", ["logs", first], { encoding: "utf8" });
    const output = logs.stdout + logs.stderr;
    assert.doesNotMatch(output, /GET|HEAD|ftplugin|privacy|Mozilla|127\.0\.0\.1|172\.\d+\./);
    const changed = docker("diff", first).split("\n").map((line) => line.slice(2));
    const expected = new Set(["/tmp", "/etc", "/etc/nginx", "/etc/nginx/conf.d", "/etc/nginx/conf.d/default.conf"]);
    assert.deepEqual(changed.filter((path) => !expected.has(path) && !path.startsWith("/tmp/")), []);
    assert.deepEqual(changed.filter((path) => /log/i.test(path)), []);
  });

  test("the template fills in the host name and no other environment variable", () => {
    const conf = docker("exec", first, "cat", "/etc/nginx/conf.d/default.conf");
    assert.match(conf, /state=\/var\/lib\/ft-downloads\/web-1\.json/);
    assert.match(conf, /try_files \$uri \$uri\/ =404;/);
    assert.match(conf, /map \$http_accept_language \$landing_lang/);
  });

  test("the totals survive a stop, including a download made just before it", async () => {
    docker("stop", first);
    const second = `ft-web-downloads-test-b-${suffix}`;
    const secondPort = start(second, { hostname: "web-1" });
    await ready(secondPort);
    assert.equal((await fetchRaw(secondPort, packagePath)).status, 200);
    docker("stop", second);
    const third = `ft-web-downloads-test-c-${suffix}`;
    start(third, { hostname: "web-1" });
    await waitForTotals(third, "web-1", { [keyOf("app")]: 3, [keyOf("other")]: 1 });
  });

  test("without a mounted volume the image still serves and counts", async () => {
    const loose = `ft-web-downloads-test-d-${suffix}`;
    const loosePort = start(loose, { withVolume: false });
    await ready(loosePort);
    assert.equal((await fetchRaw(loosePort, "/privacy/")).status, 200);
    assert.equal((await fetchRaw(loosePort, packagePath)).status, 200);
    const hostname = docker("exec", loose, "hostname");
    await waitForTotals(loose, hostname, { [keyOf("app")]: 1 });
  });

  test("totals older than 25 months are dropped when the server starts", async () => {
    const oldVolume = `${volume}-old`;
    volumes.push(oldVolume);
    docker("volume", "create", oldVolume);
    const seeded = JSON.stringify({ "2020-01|com.flickertalk.board|1.0.0|app": { value: 5 }, [keyOf("app")]: { value: 2 } });
    docker("run", "--rm", "--entrypoint", "sh", "-v", `${oldVolume}:${STATE_DIR}`, image, "-c", `printf '%s' '${seeded}' > ${STATE_DIR}/web-9.json`);
    const pruned = `ft-web-downloads-test-e-${suffix}`;
    start(pruned, { hostname: "web-9", volumeName: oldVolume });
    await waitForTotals(pruned, "web-9", { [keyOf("app")]: 2 });
  });
});
