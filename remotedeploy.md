# Remote Development & Deployment to Mac Mini

*Created: 2025-08-20*

## Overview

This guide covers multiple approaches for developing and deploying scanner changes from a laptop to the Mac Mini production environment. Choose the method that best fits your workflow and requirements.

## 🔄 Deployment Methods Comparison

| Method | Setup Time | Dev Experience | Automation | Best For |
|--------|------------|----------------|------------|----------|
| **VS Code Remote** | 5 min | ⭐⭐⭐⭐⭐ | Manual | Active development |
| **Git + Hooks** | 15 min | ⭐⭐⭐⭐ | Auto | Production deploys |
| **rsync Scripts** | 10 min | ⭐⭐⭐ | Semi-auto | Quick iterations |
| **Docker Dev** | 30 min | ⭐⭐⭐ | Auto | Isolated environment |
| **GitHub Actions** | 20 min | ⭐⭐⭐⭐ | Full auto | Team collaboration |

---

## Option 1: Git + Automated Deployment (Recommended for Production)

### Setup Git Repository on Mac Mini

```bash
# On Mac Mini - create bare repository
ssh user@mac-mini-ip
cd /opt/scanner-deployment
git init --bare scanner.git

# Setup post-receive hook for automatic deployment
cat > scanner.git/hooks/post-receive << 'EOF'
#!/bin/bash
cd /Users/ryanheger/scannerlocal
git --git-dir=/opt/scanner-deployment/scanner.git --work-tree=/Users/ryanheger/scannerlocal checkout -f

echo "🚀 Deploying changes..."
cd /Users/ryanheger/scannerlocal/apps/workers

# Install dependencies if package.json changed
npm install

# Build TypeScript
npm run build

# Restart scanner with PM2
pm2 restart scanner-local

echo "✅ Deployment complete!"
EOF

chmod +x scanner.git/hooks/post-receive
```

### From Your Laptop

```bash
# Add Mac Mini as remote
git remote add production user@mac-mini-ip:/opt/scanner-deployment/scanner.git

# Deploy changes with one command
git push production main
# Automatically: pulls code, builds, restarts service
```

### Benefits
- ✅ **One-command deployment**: `git push production main`
- ✅ **Automatic build and restart**: No manual steps
- ✅ **Version control**: Full Git history on production
- ✅ **Rollback capability**: `git reset --hard previous-commit`

---

## Option 2: VS Code Remote Development (Best Developer Experience)

### Setup Remote SSH in VS Code

```bash
# Install VS Code Remote-SSH extension
# Add to ~/.ssh/config on laptop:

Host mac-mini-scanner
    HostName YOUR_MAC_MINI_IP
    User your-username
    IdentityFile ~/.ssh/id_rsa
    Port 22
```

### Direct Remote Development

```bash
# In VS Code:
# Cmd+Shift+P → "Remote-SSH: Connect to Host"
# Select "mac-mini-scanner"
# Open folder: /Users/ryanheger/scannerlocal

# Now you're editing directly on Mac Mini:
# - Full IntelliSense and debugging
# - Terminal runs on Mac Mini
# - No sync needed - you're working directly on target
```

### Benefits
- ✅ **Zero sync lag**: Edit directly on target machine
- ✅ **Full IDE features**: IntelliSense, debugging, extensions
- ✅ **Native tool access**: Run security tools directly
- ✅ **Real-time testing**: Instant feedback on changes

---

## Option 3: Automated Sync Scripts

### rsync-based Deployment

```bash
#!/bin/bash
# deploy.sh - Run from laptop

MAC_MINI="user@mac-mini-ip"
LOCAL_PATH="/Users/you/scanner-local/"
REMOTE_PATH="/Users/ryanheger/scannerlocal/"

echo "🚀 Syncing code to Mac Mini..."

# Sync files (excluding node_modules, .git)
rsync -avz --exclude 'node_modules' \
           --exclude '.git' \
           --exclude 'dist' \
           --exclude 'scan-reports' \
           --exclude 'scan-artifacts' \
           --delete \
           "$LOCAL_PATH" "$MAC_MINI:$REMOTE_PATH"

echo "📦 Building and restarting..."

# Build and restart on Mac Mini
ssh "$MAC_MINI" << 'EOF'
cd /Users/ryanheger/scannerlocal/apps/workers
npm install
npm run build
pm2 restart scanner-local
pm2 logs scanner-local --lines 10
EOF

echo "✅ Deployment complete!"
```

### Watch Mode for Development

```bash
#!/bin/bash
# watch-deploy.sh - Auto-deploy on file changes

fswatch -o /Users/you/scanner-local/apps/workers/src | while read num; do
    echo "📝 Changes detected, deploying..."
    ./deploy.sh
done
```

### Benefits
- ✅ **Fast sync**: Only changed files transferred
- ✅ **Selective deployment**: Control what gets synced
- ✅ **Watch mode**: Automatic deployment on file changes
- ✅ **No Git required**: Works with any file changes

---

## Option 4: Docker-based Development

### Containerized Development Environment

```dockerfile
# Dockerfile.dev
FROM node:18

WORKDIR /app
COPY package*.json ./
RUN npm install

# Mount source code as volume for live editing
VOLUME ["/app/src"]

CMD ["npm", "run", "dev"]
```

### Docker Compose Development

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  scanner-dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./apps/workers/src:/app/src
      - ./apps/workers/package.json:/app/package.json
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://scanner:dev@db:5432/scanner_dev
    depends_on:
      - db
      
  db:
    image: postgres:16
    environment:
      - POSTGRES_DB=scanner_dev
      - POSTGRES_USER=scanner
      - POSTGRES_PASSWORD=dev
    ports:
      - "5432:5432"
```

### Benefits
- ✅ **Isolated environment**: Consistent across machines
- ✅ **Easy setup**: One command to start everything
- ✅ **Database included**: Full stack in containers
- ✅ **Production parity**: Same environment as deployment

---

## Option 5: GitHub Actions CI/CD

### Automated Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Mac Mini

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Mac Mini
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.MAC_MINI_HOST }}
        username: ${{ secrets.MAC_MINI_USER }}
        key: ${{ secrets.MAC_MINI_SSH_KEY }}
        script: |
          cd /Users/ryanheger/scannerlocal
          git pull origin main
          cd apps/workers
          npm install
          npm run build
          pm2 restart scanner-local
```

### GitHub Secrets Setup

```bash
# Required secrets in GitHub repository settings:
MAC_MINI_HOST=your-mac-mini-ip
MAC_MINI_USER=your-username  
MAC_MINI_SSH_KEY=your-private-ssh-key
```

### Benefits
- ✅ **Fully automated**: Push to GitHub → Auto-deploy
- ✅ **Team collaboration**: Multiple developers can deploy
- ✅ **Build logs**: Centralized deployment history
- ✅ **Slack integration**: Notifications on success/failure

---

## 🔒 Security Considerations

### SSH Key Management

```bash
# Generate deployment-specific SSH key
ssh-keygen -t ed25519 -f ~/.ssh/mac_mini_deploy

# Add to Mac Mini authorized_keys with restrictions
command="/usr/local/bin/deploy-only.sh" ssh-ed25519 AAAA... laptop-deploy-key

# deploy-only.sh script limits what can be executed
#!/bin/bash
case "$SSH_ORIGINAL_COMMAND" in
  "cd /Users/ryanheger/scannerlocal && git pull")
    cd /Users/ryanheger/scannerlocal && git pull
    ;;
  "pm2 restart scanner-local")
    pm2 restart scanner-local
    ;;
  *)
    echo "Command not allowed"
    exit 1
    ;;
esac
```

### Network Security Options

#### Option 1: VPN Connection
```bash
# Setup Tailscale/WireGuard for secure laptop↔Mac Mini connection
# Install Tailscale on both machines for automatic mesh VPN
```

#### Option 2: SSH over ngrok tunnel
```bash
# Use existing ngrok tunnel for SSH access
ngrok tcp 22  # Expose SSH through ngrok
ssh user@0.tcp.ngrok.io -p 12345
```

#### Option 3: Cloudflare tunnel SSH
```bash
# Expose SSH through Cloudflare tunnel
cloudflared tunnel create ssh-tunnel
cloudflared tunnel route dns ssh-tunnel ssh.yourdomain.com
cloudflared tunnel run ssh-tunnel
```

---

## 🛠 Development Environment Setup

### Local Development (Laptop)

```bash
# Mirror Mac Mini environment locally
brew install postgresql@16 httpx nuclei sslscan

# Use same Node.js version as Mac Mini
nvm install 18
nvm use 18

# Run tests locally before deploying
npm test
npm run build
```

### Environment Synchronization

```bash
# .env.development (laptop)
DATABASE_URL=postgresql://localhost:5432/scanner_dev
NODE_ENV=development
DEBUG=true

# .env.production (Mac Mini)  
DATABASE_URL=postgresql://localhost:5432/scanner_local
NODE_ENV=production
PM2_HOME=/Users/ryanheger/.pm2
```

### Database Development Setup

```bash
# Create development database on laptop
createdb scanner_dev

# Copy schema from production
pg_dump --schema-only -h mac-mini-ip scanner_local | psql scanner_dev

# Optional: Copy recent data for testing
pg_dump --data-only --where="created_at > NOW() - INTERVAL '7 days'" \
        -h mac-mini-ip scanner_local | psql scanner_dev
```

---

## 🚀 Quick Start Guide

### 1. Setup VS Code Remote (5 minutes)

```bash
# On laptop - add to ~/.ssh/config
Host mac-mini
    HostName YOUR_MAC_MINI_IP
    User your-username
    
# In VS Code: Cmd+Shift+P → Remote-SSH: Connect
# Open /Users/ryanheger/scannerlocal
# Start coding directly on Mac Mini!
```

### 2. Add Git Deployment (optional)

```bash
# For production releases
git remote add production user@mac-mini:/path/to/bare/repo.git
git push production main  # Auto-builds and restarts
```

### 3. Setup Development Database (optional)

```bash
# Create local development environment
createdb scanner_dev
npm install
npm run build
npm run dev  # Runs on localhost:8080
```

---

## 🎯 Recommended Workflow

### For Solo Development
```bash
# Primary: VS Code Remote SSH for daily development
# Secondary: Git deployment hooks for production releases

# Setup both:
1. Configure VS Code Remote SSH (5 minutes)
2. Setup git deployment hooks (15 minutes)  
3. Use VS Code for development, git push for releases
```

### For Team Development
```bash
# GitHub Actions + Git hooks
1. Push to GitHub from laptop
2. GitHub Actions tests code
3. Auto-deploy to Mac Mini on main branch merge
4. Slack notifications on deployment success/failure
```

---

## 🔧 Troubleshooting

### Common SSH Issues

```bash
# SSH connection refused
# Check if SSH is enabled on Mac Mini:
sudo systemsetup -setremotelogin on

# Permission denied
# Check SSH key permissions:
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub

# Connection timeout
# Check firewall/router port forwarding for port 22
```

### Deployment Failures

```bash
# Check PM2 logs
pm2 logs scanner-local

# Check build errors
cd /Users/ryanheger/scannerlocal/apps/workers
npm run build

# Check PostgreSQL connection
psql scanner_local -c "SELECT 1"
```

### Git Hook Issues

```bash
# Hook not executing
chmod +x /opt/scanner-deployment/scanner.git/hooks/post-receive

# Permission errors
chown -R your-user:your-group /Users/ryanheger/scannerlocal

# Git checkout fails
cd /Users/ryanheger/scannerlocal
git status  # Check for uncommitted changes
```

---

## 📋 Deployment Checklist

### Pre-deployment
- [ ] Test changes locally
- [ ] Run TypeScript build: `npm run build`
- [ ] Run tests: `npm test`
- [ ] Check no sensitive data in commits
- [ ] Verify target branch is correct

### During deployment
- [ ] Monitor deployment logs
- [ ] Check PM2 restart success: `pm2 status`
- [ ] Verify health endpoint: `curl localhost:8080/health`
- [ ] Test basic functionality

### Post-deployment
- [ ] Check scanner logs for errors
- [ ] Verify database connectivity
- [ ] Test scan functionality
- [ ] Monitor system resources
- [ ] Update deployment documentation

---

This guide provides multiple deployment strategies to fit different development workflows and security requirements. Start with VS Code Remote for active development, then add Git hooks for production deployments as needed.