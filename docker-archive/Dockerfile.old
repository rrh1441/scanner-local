# ────────────────────────────────────────────────────────────────────────
# DealBrief‑Scanner Runtime Image (full toolkit – glibc‑compatible)
# ────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base

# ----- verify base -----
RUN node -v
WORKDIR /app

# ----- OS packages & Chrome -----
# NOTE: added **gcompat** so pre‑built glibc binaries (e.g. TruffleHog) run on musl‑based Alpine
RUN apk add --no-cache \
    bash curl wget git openssl bind-tools \
    nmap nmap-scripts \
    python3 py3-pip unzip \
    chromium nss freetype freetype-dev harfbuzz \
    ca-certificates ttf-freefont coreutils procps \
    libx11 libxcomposite libxdamage libxext libxrandr libxfixes \
    libxkbcommon libdrm libxcb libxrender pango cairo alsa-lib udev \
    sqlite sqlite-dev gcompat && \
    ln -sf /usr/bin/sqlite3 /usr/local/bin/sqlite3

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    ROD_BROWSER_BIN=/usr/bin/chromium-browser \
    HEADLESS_SKIP_BROWSER_DOWNLOAD=1 \
    NUCLEI_PREFERRED_CHROME_PATH=/usr/bin/chromium-browser \
    ROD_BROWSER=/usr/bin/chromium-browser \
    ROD_KEEP_USER_DATA_DIR=false \
    ROD_BROWSER_SKIP_DOWNLOAD=true \
    NODE_TLS_REJECT_UNAUTHORIZED=0

RUN mkdir -p /root/.cache/rod/browser/chromium-1321438 && \
    ln -s /usr/bin/chromium-browser /root/.cache/rod/browser/chromium-1321438/chrome && \
    ln -sf /usr/bin/chromium-browser /usr/bin/chrome && \
    ln -s /usr/bin/chromium-browser /usr/bin/google-chrome

# ----- security tooling -----
ARG TRUFFLEHOG_VER=3.83.7
RUN curl -sSL https://github.com/trufflesecurity/trufflehog/releases/download/v${TRUFFLEHOG_VER}/trufflehog_${TRUFFLEHOG_VER}_linux_amd64.tar.gz | tar -xz -C /usr/local/bin trufflehog

# Removed ggshield - not suitable for OSINT scanning of third-party content
# TruffleHog is the correct tool for this use case

# nuclei
RUN curl -L https://github.com/projectdiscovery/nuclei/releases/download/v3.4.5/nuclei_3.4.5_linux_amd64.zip -o nuclei.zip && \
    unzip nuclei.zip && mv nuclei /usr/local/bin/ && rm nuclei.zip && chmod +x /usr/local/bin/nuclei && \
    mkdir -p /opt/nuclei-templates && nuclei -update-templates -ut /opt/nuclei-templates
ENV NUCLEI_TEMPLATES=/opt/nuclei-templates

# dnstwist, spiderfoot, whatweb, sslscan, ZAP, etc.
RUN pip3 install --break-system-packages dnstwist webtech python-gvm gvm-tools aiohttp && \
    apk add --no-cache ruby ruby-dev make gcc musl-dev sslscan && \
    git clone https://github.com/urbanadventurer/WhatWeb.git /opt/whatweb && \
    ln -s /opt/whatweb/whatweb /usr/local/bin/whatweb && chmod +x /usr/local/bin/whatweb && \
    git clone https://github.com/smicallef/spiderfoot.git /opt/spiderfoot && \
    pip3 install --break-system-packages -r /opt/spiderfoot/requirements.txt && \
    chmod +x /opt/spiderfoot/sf.py && ln -s /opt/spiderfoot/sf.py /usr/local/bin/sf && ln -s /opt/spiderfoot/sf.py /usr/local/bin/spiderfoot.py

# ------------------------------------------------------------------------
# OWASP ZAP – baseline script (no full GUI)
# ------------------------------------------------------------------------
    RUN apk add --no-cache openjdk11-jre \
    && pip3 install --break-system-packages python-owasp-zap-v2.4 \
    # make sure the directory chain exists BEFORE we write into it
    && mkdir -p /usr/local/lib/python3.12/site-packages \
    # grab the helper scripts with automatic retry/back-off
    && curl -Lf --retry 5 --retry-delay 2 \
         https://raw.githubusercontent.com/zaproxy/zaproxy/main/docker/zap-baseline.py \
         -o /usr/local/bin/zap-baseline.py \
    && curl -Lf --retry 5 --retry-delay 2 \
         https://raw.githubusercontent.com/zaproxy/zaproxy/main/docker/zap_common.py \
         -o /usr/local/lib/python3.12/site-packages/zap_common.py \
    && chmod +x /usr/local/bin/zap-baseline.py \
    && mkdir -p /root/.ZAP

# ----- Node tooling & deps -----
RUN npm install -g pnpm tsx
COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api-main/package.json ./apps/api-main/
COPY apps/workers/package.json ./apps/workers/
RUN pnpm install

# ----- source & build -----
COPY . .
RUN pnpm build

RUN mkdir -p /tmp && chmod 777 /tmp
EXPOSE 3000
CMD ["node","apps/workers/dist/worker-pubsub.js"]