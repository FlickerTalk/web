# flickertalk.com

The FlickerTalk landing: static HTML and CSS, no JavaScript, no framework, nothing loaded from
another site. Black and white.

```sh
npm test                                                     # checks the pages and nginx.conf
docker build -t ft-web . && docker run -p 8080:8080 ft-web   # http://localhost:8080
```

`site/` holds the pages, `nginx.conf` the server (no access logs, strict content security policy).
Every push to `main` publishes the image and deploys it.
