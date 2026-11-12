# syntax=docker/dockerfile:1
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
ARG VERSION=dev
USER root
RUN echo "$VERSION" > /usr/share/nginx/html/version.txt
USER 101
