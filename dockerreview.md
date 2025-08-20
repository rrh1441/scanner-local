# Docker Implementation Review & Optimization

## Objective
Systematically review and optimize the Docker implementation for the dealbrief-scanner project, focusing on the worker container that processes security scanning jobs.

## Current Issues Identified
- **Critical**: File path resolution failure - `worker-pubsub.js` not found at expected location
- **Build Process**: TypeScript compilation may be failing silently 
- **File Structure**: Mismatch between build output location and runtime expectations

## Review Tasks

### 1. Dockerfile Analysis
- [ ] Review `Dockerfile.worker` build process and file copying logic
- [ ] Verify TypeScript compilation step (`npm run build || npx tsc || true`)
- [ ] Check if built files are in expected locations
- [ ] Validate file permissions and accessibility

### 2. Build Output Investigation  
- [ ] Examine actual build output structure in `apps/workers/dist/`
- [ ] Verify `worker-pubsub.js` gets created during build
- [ ] Check if source maps and dependencies are properly included
- [ ] Test build process locally vs in Docker container

### 3. Path Resolution Fix
- [ ] Determine correct file paths for all worker entry points
- [ ] Update Cloud Run job configuration to match actual file locations
- [ ] Ensure consistent path handling between local development and production

### 4. Container Optimization
- [ ] Review base image choice (node:18-slim) for security and size
- [ ] Optimize layer caching by reordering Dockerfile instructions
- [ ] Minimize final image size by removing unnecessary dependencies
- [ ] Implement multi-stage build if beneficial

### 5. Dependency Management
- [ ] Review and optimize `npm install --legacy-peer-deps` usage
- [ ] Ensure all runtime dependencies are properly installed
- [ ] Check for security vulnerabilities in dependencies
- [ ] Consider using `npm ci` for production builds

### 6. Security Tools Integration  
- [ ] Verify nuclei installation and accessibility
- [ ] Test chromium/puppeteer configuration
- [ ] Ensure all security scanning tools are functional in container

### 7. Environment Configuration
- [ ] Review environment variables and secrets handling
- [ ] Verify Cloud Run job configuration matches container expectations
- [ ] Test resource limits (4 CPU, 6GB RAM) are appropriate

## Deliverables
1. **Fixed Dockerfile** that reliably builds and runs the worker
2. **Updated deployment scripts** with correct file paths
3. **Build verification script** to test locally before deployment
4. **Optimization recommendations** for performance and security
5. **Updated job configuration** that matches the container structure

## Testing Requirements
- [ ] Local Docker build must succeed without errors
- [ ] Container must start and find all required files
- [ ] Worker must successfully process Pub/Sub messages
- [ ] All security scanning tools must be accessible and functional

## Success Criteria
- Worker container starts without file not found errors
- Pub/Sub messages are successfully processed within 5-minute timeout
- Build process is reliable and optimized for CI/CD
- Container follows Docker best practices for security and performance