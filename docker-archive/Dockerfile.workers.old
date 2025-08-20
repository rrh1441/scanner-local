# Build stage
FROM node:20-slim AS builder

# Install Python and other dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript files and build configuration
COPY . .

# Build TypeScript
RUN npm run build

# Runtime stage
FROM node:20-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies for whois module
RUN pip3 install --no-cache-dir \
    python-whois \
    requests

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy necessary non-JS files
COPY templates ./templates
COPY scripts ./scripts
COPY modules/*.py ./modules/

# Create a non-root user
RUN useradd -m -u 1001 scanner && chown -R scanner:scanner /app
USER scanner

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# The main command will be overridden by Cloud Run Job configuration
CMD ["node", "dist/worker.js"]