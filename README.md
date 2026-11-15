# flickertalk.com

The FlickerTalk landing: static HTML and CSS, no JavaScript, no framework, nothing loaded from
another site except the trailer on the home page. Black and white.

```sh
npm test                                                     # the pages, nginx.conf and, with Docker, the image
docker build -t ft-web . && docker run -p 8080:8080 ft-web   # http://localhost:8080
```

`npm test` builds and runs the image when Docker is available, and says it skipped that part when
it is not.

`site/` holds the pages, `nginx.conf` the server (no access logs, strict content security policy).
Every push to `main` publishes the image and deploys it.

The trailer is a YouTube player from `www.youtube-nocookie.com`, the only frame the content
security policy admits. nginx sends `Referrer-Policy: no-referrer`, and YouTube will not play
without a referrer (its error 153), so the iframe alone has `referrerpolicy="origin"`: the player
gets the site's origin, never the path.

## App Store

The App Store listing is not public yet. Until it is, no page links to it or shows Apple's badge,
and the pages say the iPhone version is coming soon, with no date; `tests/site.test.mjs` checks
it. When the listing goes public, the badge and the links go back in, and those tests change with
them.

## Plugin catalogue

`site/plugins/` is the signed catalogue the app installs plugins from. It has two indexes:

- `catalogue.json`: every plugin, each with the app version it needs (`minCoreVersion`). The app
  reads it from 1.1.0 on.
- `index.json`: for the app 1.0.0, which ignores `minCoreVersion`, so it lists only the plugins
  that run there.

`ftcatalogue` in [FlickerTalk/app](https://github.com/FlickerTalk/app) (`crates/ft-plugins`) writes
the packages and both indexes with their signatures; nothing in `site/plugins/` is edited by hand.

## Package download totals

nginx counts how many times each package is downloaded, as totals, with a small njs module
(`njs/downloads.js`). Nothing is written per request and there is still no access log.

A download is a `GET` of `/plugins/com.flickertalk.<name>/<version>.ftplugin` answered 200 without
a `Range` header. `HEAD`, ranges, `304`, `404` and every other path count nothing. Of the request,
the module reads only the method, the status, the path and whether `User-Agent` and `Range` are
present. It keeps no IP address, time, header value or anything else that could tie two downloads
together.

### The state file

Each container keeps its totals in `/var/lib/ft-downloads/<host name>.json`. nginx reads it when it
starts and writes it about a second after a total changes, and when it stops. It writes
`<host name>.json.tmp` first and renames it, so a reader never sees half a file.

```json
{"2026-11|com.flickertalk.game.chess|1.0.6|app":{"value":2.000000},"2026-11|com.flickertalk.game.chess|1.0.6|other":{"value":1.000000}}
```

- One entry per total. The key is `month|package id|version|client`, separated by `|`:
  - `month`: `YYYY-MM`, in UTC;
  - `package id` and `version`: from the path;
  - `client`: `app` when the request has no `User-Agent` (the app sends none), `other` when it has
    one.
- The value is an object with one field, `value`, the total. nginx writes it as a number with six
  decimals (`2.000000`); read it as a number.
- Entries come in no particular order. Totals older than the current month and the 24 before it are
  deleted when nginx starts and once a day.
- To get the totals of a site with several containers, add up the files of all of them.

Read the files, never write them. nginx refuses to start if its file is not valid JSON in this form.

### Running it

- Mount a volume on `/var/lib/ft-downloads` so the totals outlive the container. The image creates
  the folder for user 101, so a new named volume gets the right owner.
- Give each container a fixed host name: it names the file. `nginx.conf` is a template the image's
  entrypoint fills in with `${HOSTNAME}` when the container starts; no other environment variable
  is substituted (`NGINX_ENVSUBST_FILTER`).
- Never let two running containers share a host name and a volume: each would overwrite the other's
  file.
- Without a volume the site works the same; the file lives inside the container and is lost with it.

## App Links and Universal Links

Contact links (`https://flickertalk.com/add#…`) and move links (`/move#…`) open the app when it is
installed, and this site's page otherwise. Two files tell the phones the app may handle them:

- `site/.well-known/assetlinks.json` (Android App Links): the package `com.flickertalk.app` and the
  SHA-256 fingerprints of the certificates that sign it. Fingerprints are public; the file is
  versioned as it is served.
- `site/.well-known/apple-app-site-association` (iOS Universal Links, `/add` and `/move`): a static
  file, public by design, versioned as it is served. The Apple team ID in it is not a secret: it is
  in every iOS app bundle and in every app's `apple-app-site-association`.

nginx answers both as `application/json`, with the same headers as every page and no redirect.
