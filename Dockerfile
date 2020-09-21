FROM node:lts-alpine

# Build-time metadata as defined at http://label-schema.org
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION
LABEL org.label-schema.build-date=$BUILD_DATE \
    org.label-schema.name="Naas proxy API" \
    org.label-schema.description="proxy server for naas public urls" \
    org.label-schema.url="https://naas.ai" \
    org.label-schema.vcs-ref=$VCS_REF \
    org.label-schema.vcs-url="https://github.com/jupyter-naas/proxy" \
    org.label-schema.vendor="Cashstory, Inc." \
    org.label-schema.version=$VERSION \
    org.label-schema.schema-version="1.0"

ENV NPM_CONFIG_LOGLEVEL warn
ENV NODE_ENV production
ENV TZ Europe/Paris

# Install tzdata for cron job
RUN apk add --no-cache git tzdata && rm -rf /tmp/* /var/tmp/* /var/cache/apk/*

RUN mkdir -p /app
WORKDIR /app

# install dependency
COPY package*.json /app/
RUN npm ci

# install server
COPY index.js /app/index.js
CMD [ "node", "app/index.js" ]
