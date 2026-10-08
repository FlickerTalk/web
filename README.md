# flickertalk.com

The FlickerTalk landing: static HTML and CSS, no JavaScript, no framework, nothing loaded from
another site. Black and white.

```sh
npm test                                                     # checks the pages and nginx.conf
printf '%s' ABCDE12345 > /tmp/team-id                        # any 10-character team ID, for a local build
docker build --secret id=apple_team_id,src=/tmp/team-id -t ft-web . && docker run -p 8080:8080 ft-web   # http://localhost:8080
```

`site/` holds the pages, `nginx.conf` the server (no access logs, strict content security policy).
Every push to `main` publishes the image and deploys it.

## App Links and Universal Links

Contact links (`https://flickertalk.com/add#…`) and move links (`/move#…`) open the app when it is
installed, and this site's page otherwise. Two files tell the phones the app may handle them:

- `site/.well-known/assetlinks.json` (Android App Links): the package `com.flickertalk.app` and the
  SHA-256 fingerprints of the certificates that sign it. Fingerprints are public; the file is
  versioned as it is served.
- `/.well-known/apple-app-site-association` (iOS Universal Links, `/add` and `/move`): it names the
  Apple team, which is not kept in this repo. The image fills in
  `well-known/apple-app-site-association.template` at build time from the build secret
  `apple_team_id`, and **the build fails** if the secret is missing or is not a 10-character team
  ID. The CI takes it from the repository secret `APPLE_TEAM_ID`; pull requests build with a
  made-up one.

nginx answers both as `application/json`, with the same headers as every page and no redirect.
