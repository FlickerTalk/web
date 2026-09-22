# web/ (landing)

Sitio `flickertalk.com` (`Plan.md §77`), **estático**. Páginas: What is FlickerTalk, Privacy
architecture, Download, FAQ, Privacy Policy, Terms, Security, Transparency, Contact.

## Reglas

- Sin trackers de marketing ni analytics.
- Inglés en la fase 1; las traducciones se decidirán más adelante (`§84`). Antes del
  lanzamiento, comprobar si los textos legales (privacidad, términos) necesitan versión en
  español para los usuarios de España.
- **Afirmaciones de privacidad precisas** (`§70`, `§78`): no decir «FlickerTalk no procesa
  ningún dato», «nunca ve una IP» ni —desde el buzón de `§19`— «no almacena mensajes». Lo
  correcto: FlickerTalk no almacena conversaciones, agendas, claves privadas ni historiales de
  comunicación; los mensajes que no pueden entregarse directamente se guardan cifrados de
  extremo a extremo, sin que FlickerTalk pueda leerlos, solo hasta su entrega o caducidad; y no
  conserva historiales de IP.
- Precio (`§40`): 1 €/año, con el primer año gratis desde la instalación; **menores de 21, siempre
  gratis** (2026-09-22). Debe figurar desde el lanzamiento en la landing y en los términos.
- Documentar con claridad los límites del modelo (`§67–69`, `§99`): los peers ven sus IPs
  públicas, Google STUN ve conexiones y Google/Apple ven metadatos de push.

## Estado (2026-09-22)

- **HTML y CSS puros, sin JavaScript ni framework** (`site/`): portada, `how-it-works/`,
  `security/`, `faq/`, `transparency/`, `privacy/`, `terms/` y `404.html`. **Minimalista, en
  blanco y negro** (decisión de Ioan, 2026-09-22): un test comprueba que la hoja de estilos solo
  usa grises. Modo oscuro automático, sin fuentes web. La marca, en una sola tinta
  (`assets/mark.svg`); el icono de color queda para la app y el favicon.
- Responsable: **ERPLORA CLOUD SL** (NIF B27593136). El domicilio solo aparece en la política de
  privacidad y en los términos (LSSI art. 10, RGPD art. 13); en el pie, el nombre y el NIF. Los
  términos dicen que la app se ofrece «as is», sin garantía, y que se usa bajo la responsabilidad
  del usuario, dentro de lo que permite la ley de consumidores.
- **Tests** (`npm test`, `node --test`, sin dependencias): que existan las páginas, que no haya
  scripts, estilos en línea ni nada de otros sitios, que los enlaces internos funcionen, que estén
  el precio, los límites del modelo y los datos del responsable, que no aparezca ninguna afirmación
  prohibida y que nginx no guarde logs (ni el de errores, que daría la IP en cada 404).
- **Servidor**: `nginx.conf` + `Dockerfile` (nginx sin root, puerto 8080). Política de seguridad
  de contenidos `default-src 'none'`, sin logs de acceso, y el navegador revalida siempre (ETag),
  así que un cambio se ve al momento. `/version.txt` dice qué commit se sirve.
- **CI/CD** (`.github/workflows/web.yml`, `§105`): cada PR pasa los tests y prueba la imagen; cada
  push a `main` publica `ghcr.io/flickertalk/web` y redespliega el stack con su webhook de Dokploy
  (entorno `production`, solo `main`), esperando a que `flickertalk.com/version.txt` sirva el
  commit. La web no tiene canal canary.
- Enlaces de descarga: «Coming soon» hasta que existan las fichas de Google Play
  (`play.google.com/store/apps/details?id=com.flickertalk.app`) y del App Store (su ID lo asigna
  Apple). Entonces, los botones oficiales de cada tienda, guardados en `site/assets/`.

```sh
npm test                                              # tests del sitio
docker build -t ft-web . && docker run -p 8080:8080 ft-web   # http://localhost:8080
```
