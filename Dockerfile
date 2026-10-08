# syntax=docker/dockerfile:1
# flickertalk.com: nginx without root, serving site/ (Plan §77).
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
# What is deployed, so that a deploy can wait for it.
ARG VERSION=dev
USER root
RUN echo "$VERSION" > /usr/share/nginx/html/version.txt
# iOS Universal Links: apple-app-site-association names the Apple team, which is not kept in this
# repo. It comes from the build secret apple_team_id (docker build --secret id=apple_team_id,...)
# and the build stops if it is missing or is not a team ID.
RUN --mount=type=secret,id=apple_team_id \
    --mount=type=bind,source=well-known,target=/tmp/well-known \
    team="$(cat /run/secrets/apple_team_id 2>/dev/null || true)"; \
    case "$team" in ''|*[!A-Z0-9]*) team="";; esac; \
    if [ "${#team}" -ne 10 ]; then \
      echo "error: the build secret apple_team_id is missing or is not a 10-character Apple team ID" >&2; \
      exit 1; \
    fi; \
    sed "s/__APPLE_TEAM_ID__/$team/g" /tmp/well-known/apple-app-site-association.template \
      > /usr/share/nginx/html/.well-known/apple-app-site-association
USER 101
