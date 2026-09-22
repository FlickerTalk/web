# flickertalk.com: nginx without root, serving site/ (Plan §77).
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
# What is deployed, so that a deploy can wait for it.
ARG VERSION=dev
USER root
RUN echo "$VERSION" > /usr/share/nginx/html/version.txt
USER 101
