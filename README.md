# flickertalk.com

The FlickerTalk landing: static HTML and CSS, no JavaScript, no framework, nothing loaded from
another site except the trailer on the home page. Black and white.

```sh
npm test                                                     # checks the pages and nginx.conf
docker build -t ft-web . && docker run -p 8080:8080 ft-web   # http://localhost:8080
```

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
