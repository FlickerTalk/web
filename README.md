# flickertalk.com

The FlickerTalk landing: static HTML and CSS, no JavaScript, no framework, nothing loaded from
another site. Black and white.

```sh
npm test                                                     # checks the pages and nginx.conf
docker build -t ft-web . && docker run -p 8080:8080 ft-web   # http://localhost:8080
```

`site/` holds the pages, `nginx.conf` the server (no access logs, strict content security policy).
Every push to `main` publishes the image and deploys it.

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
