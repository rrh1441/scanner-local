FROM node:18-slim

WORKDIR /app

# Copy package files and install all dependencies (including dev for TypeScript)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies for smaller image
RUN npm ci --omit=dev && npm cache clean --force

# Create non-root user
RUN groupadd -r reportuser && useradd -r -g reportuser reportuser
RUN chown -R reportuser:reportuser /app
USER reportuser

# Set resource limits for Cloud Run (512MB for Chromium + app)
ENV NODE_OPTIONS="--max-old-space-size=512"
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]