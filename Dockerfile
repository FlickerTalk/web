# syntax=docker/dockerfile:1
FROM nginxinc/nginx-unprivileged:stable-alpine
# The entrypoint would replace any $name in nginx.conf that matches an environment variable.
ENV NGINX_ENVSUBST_FILTER=^HOSTNAME$
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY njs/ /etc/nginx/njs/
COPY site/ /usr/share/nginx/html/
ARG VERSION=dev
USER root
RUN echo "$VERSION" > /usr/share/nginx/html/version.txt \
    && sed -i '1i load_module modules/ngx_http_js_module.so;' /etc/nginx/nginx.conf \
    && rm /etc/nginx/conf.d/default.conf \
    && install -d -o 101 -g 101 /var/lib/ft-downloads
USER 101
