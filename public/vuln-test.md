This file is a merged representation of the entire codebase, combined into a single document by Repomix.

<file_summary>
This section contains a summary of this file.

<purpose>
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.
</purpose>

<file_format>
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  - File path as an attribute
  - Full contents of the file
</file_format>

<usage_guidelines>
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.
</usage_guidelines>

<notes>
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)
</notes>

</file_summary>

<directory_structure>
.claude/
  settings.local.json
config.json
endpoints.html
index.html
README.md
vulnerabilities.html
</directory_structure>

<files>
This section contains the contents of the repository's files.

<file path=".claude/settings.local.json">
{
  "permissions": {
    "allow": [
      "Bash(git init:*)",
      "Bash(gh repo create:*)",
      "Bash(git add:*)",
      "Bash(git push:*)",
      "Bash(git remote add:*)",
      "Bash(mkdir:*)",
      "Bash(git commit:*)"
    ],
    "deny": []
  }
}
</file>

<file path="config.json">
{
  "database": {
    "supabase_url": "https://ltiuuauafphpwewqktdv.supabase.co",
    "supabase_anon_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0aXV1YXVhZnBocHdld3FrdGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzNjU0NjcsImV4cCI6MjA1MTk0MTQ2N30.Qg5k6B0_jvGqZJJOOTvZCIgqLBHvJJVyMrOzQdMjhHs",
    "supabase_service_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0aXV1YXVhZnBocHdld3FrdGR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjM2NTQ2NywiZXhwIjoyMDUxOTQxNDY3fQ.bZNdRQzTfgJGhg7iV4OjKpP_5fzJ3lXlKGmkqFqS4rQ",
    "postgres_host": "aws-0-us-east-1.pooler.supabase.com",
    "postgres_port": 5432,
    "postgres_db": "postgres",
    "postgres_user": "postgres",
    "postgres_password": "VerySecurePassword123!"
  },
  "api_endpoints": {
    "employees": "https://ltiuuauafphpwewqktdv.supabase.co/rest/v1/employees",
    "salaries": "https://ltiuuauafphpwewqktdv.supabase.co/rest/v1/salaries",
    "admin": "https://ltiuuauafphpwewqktdv.supabase.co/rest/v1/admin_users"
  },
  "debug": true,
  "environment": "development"
}
</file>

<file path="endpoints.html">
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Endpoints - Company Portal</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .endpoint { margin: 15px 0; padding: 15px; background: #f9f9f9; border-radius: 4px; border-left: 4px solid #007cba; }
        .method { font-weight: bold; color: #007cba; }
        .path { font-family: monospace; background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
        .vulnerability { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Discoverable API Endpoints</h1>
        <p>This page lists vulnerable endpoints that should be discovered by security scanners.</p>
        
        <div class="endpoint">
            <div class="method">GET</div>
            <div class="path">/api/admin/users</div>
            <div class="vulnerability">⚠️ Admin endpoint without authentication</div>
            <p>Returns admin user information including hashed passwords and API keys.</p>
        </div>
        
        <div class="endpoint">
            <div class="method">GET</div>
            <div class="path">/api/internal/debug</div>
            <div class="vulnerability">⚠️ Internal debug endpoint exposed</div>
            <p>Exposes system configuration, environment variables, and sensitive information.</p>
        </div>
        
        <div class="endpoint">
            <div class="method">POST</div>
            <div class="path">/api/v1/auth/bypass</div>
            <div class="vulnerability">⚠️ Authentication bypass methods</div>
            <p>Provides various ways to bypass authentication controls.</p>
        </div>
        
        <div class="endpoint">
            <div class="method">GET/POST</div>
            <div class="path">/graphql</div>
            <div class="vulnerability">⚠️ GraphQL introspection enabled</div>
            <p>GraphQL endpoint with introspection enabled, exposing schema and sensitive queries.</p>
        </div>
        
        <div class="endpoint">
            <div class="method">POST</div>
            <div class="path">/api/login</div>
            <div class="vulnerability">⚠️ No rate limiting</div>
            <p>Login endpoint vulnerable to brute force attacks.</p>
        </div>
        
        <div class="endpoint">
            <div class="method">GET</div>
            <div class="path">/api/search</div>
            <div class="vulnerability">⚠️ No throttling, SQL injection</div>
            <p>Search endpoint with SQL injection vulnerability and no rate limiting.</p>
        </div>
        
        <div class="endpoint">
            <div class="method">GET</div>
            <div class="path">/search</div>
            <div class="vulnerability">⚠️ SQL injection</div>
            <p>Search page with SQL injection vulnerability in query parameter.</p>
        </div>
        
        <div class="endpoint">
            <div class="method">GET</div>
            <div class="path">/comment</div>
            <div class="vulnerability">⚠️ XSS vulnerability</div>
            <p>Comment system vulnerable to cross-site scripting attacks.</p>
        </div>
        
        <div class="endpoint">
            <div class="method">GET</div>
            <div class="path">/files</div>
            <div class="vulnerability">⚠️ Directory traversal</div>
            <p>File browser with directory traversal vulnerability.</p>
        </div>
        
        <h2>📁 Exposed Files</h2>
        <ul>
            <li><strong>/.env</strong> - Environment variables with secrets</li>
            <li><strong>/backup.sql</strong> - Database backup with sensitive data</li>
            <li><strong>/admin/users.txt</strong> - Admin user credentials</li>
            <li><strong>/logs/error.log</strong> - Application error logs</li>
            <li><strong>/wp-config.php</strong> - WordPress configuration</li>
            <li><strong>/package.json</strong> - Node.js dependencies</li>
        </ul>
        
        <h2>🔧 Technology Stack</h2>
        <ul>
            <li>WordPress 5.8.2</li>
            <li>Express.js 4.17.1</li>
            <li>Node.js 16.14.0</li>
            <li>PostgreSQL 13.4</li>
            <li>Nginx 1.18.0</li>
            <li>Ubuntu 20.04.3 LTS</li>
        </ul>
    </div>
</body>
</html>
</file>

<file path="index.html">
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Company Dashboard - Internal Use Only</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { background: #2563eb; color: white; padding: 15px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
        .config-section { background: #fef3c7; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .data-section { background: #f0f9ff; padding: 15px; margin: 20px 0; border-left: 4px solid #0ea5e9; }
        .error { background: #fef2f2; color: #dc2626; padding: 10px; margin: 10px 0; border-radius: 4px; }
        button { background: #2563eb; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        button:hover { background: #1d4ed8; }
        .debug { background: #f3f4f6; padding: 10px; margin: 10px 0; border-radius: 4px; font-family: monospace; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f9fafb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Company Internal Dashboard</h1>
            <p>Employee Database Access Portal</p>
        </div>

        <div class="config-section">
            <h2>⚠️ Debug Information</h2>
            <p><strong>Database URL:</strong> <code>https://ltiuuauafphpwewqktdv.supabase.co</code></p>
            <p><strong>Project ID:</strong> <code>ltiuuauafphpwewqktdv</code></p>
            <p><strong>Environment:</strong> DEVELOPMENT (Debug Mode Enabled)</p>
        </div>

        <div class="data-section">
            <h2>📊 Employee Database</h2>
            <button onclick="loadEmployees()">Load Employee Data</button>
            <button onclick="testDatabaseConnection()">Test DB Connection</button>
            <button onclick="showConfig()">Show Full Config</button>
            
            <div id="employees-table"></div>
            <div id="debug-output"></div>
        </div>

        <div class="error" id="error-output" style="display: none;"></div>
    </div>

    <script>
        // 🚨 VULNERABILITY: Exposed Supabase credentials in client-side code
        const SUPABASE_URL = 'https://ltiuuauafphpwewqktdv.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0aXV1YXVhZnBocHdld3FrdGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzNjU0NjcsImV4cCI6MjA1MTk0MTQ2N30.Qg5k6B0_jvGqZJJOOTvZCIgqLBHvJJVyMrOzQdMjhHs';
        // 🚨 CRITICAL: Service role key exposed (should NEVER be in frontend)
        const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0aXV1YXVhZnBocHdld3FrdGR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjM2NTQ2NywiZXhwIjoyMDUxOTQxNDY3fQ.bZNdRQzTfgJGhg7iV4OjKpP_5fzJ3lXlKGmkqFqS4rQ';
        
        // 🚨 VULNERABILITY: Database configuration exposed
        const DB_CONFIG = {
            host: 'aws-0-us-east-1.pooler.supabase.com',
            port: 5432,
            database: 'postgres',
            user: 'postgres',
            password: 'VerySecurePassword123!',
            ssl: false
        };

        // 🚨 VULNERABILITY: API endpoints exposed
        const API_ENDPOINTS = {
            employees: `${SUPABASE_URL}/rest/v1/employees`,
            salaries: `${SUPABASE_URL}/rest/v1/salaries`,
            admin: `${SUPABASE_URL}/rest/v1/admin_users`
        };

        console.log('🔥 Database credentials loaded:', DB_CONFIG);
        console.log('🔥 API endpoints:', API_ENDPOINTS);

        async function loadEmployees() {
            try {
                showDebug('Attempting to load employees...');
                // 🚨 VULNERABILITY: Direct database queries without authentication
                const response = await fetch(`${SUPABASE_URL}/rest/v1/employees?select=*`, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const employees = await response.json();
                displayEmployees(employees);
                showDebug(`Successfully loaded ${employees.length} employee records`);
            } catch (error) {
                showError(`Database Error: ${error.message}`);
                showDebug(`Stack trace: ${error.stack}`);
            }
        }

        async function testDatabaseConnection() {
            showDebug('Testing database connection...');
            try {
                // 🚨 VULNERABILITY: Exposing database connection details
                const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                    }
                });
                
                showDebug(`Connection test: ${response.status} ${response.statusText}`);
                showDebug(`Database host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
                showDebug(`Connected as: ${DB_CONFIG.user}`);
            } catch (error) {
                showError(`Connection failed: ${error.message}`);
            }
        }

        function showConfig() {
            // 🚨 VULNERABILITY: Exposing full configuration
            const configOutput = `
<h3>🔧 Full System Configuration</h3>
<pre>
Database: ${JSON.stringify(DB_CONFIG, null, 2)}
Supabase URL: ${SUPABASE_URL}
Anon Key: ${SUPABASE_ANON_KEY}
Service Key: ${SUPABASE_SERVICE_KEY}
API Endpoints: ${JSON.stringify(API_ENDPOINTS, null, 2)}
</pre>
            `;
            document.getElementById('debug-output').innerHTML = configOutput;
        }

        function displayEmployees(employees) {
            const tableHtml = `
                <table>
                    <thead>
                        <tr><th>ID</th><th>Name</th><th>Email</th><th>Salary</th><th>SSN</th></tr>
                    </thead>
                    <tbody>
                        ${employees.map(emp => `
                            <tr>
                                <td>${emp.id}</td>
                                <td>${emp.name}</td>
                                <td>${emp.email}</td>
                                <td>$${emp.salary}</td>
                                <td>${emp.ssn}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            document.getElementById('employees-table').innerHTML = tableHtml;
        }

        function showError(message) {
            const errorDiv = document.getElementById('error-output');
            errorDiv.innerHTML = `<strong>Error:</strong> ${message}`;
            errorDiv.style.display = 'block';
        }

        function showDebug(message) {
            const debugDiv = document.getElementById('debug-output');
            debugDiv.innerHTML += `<div class="debug">[${new Date().toISOString()}] ${message}</div>`;
        }

        // 🚨 VULNERABILITY: Auto-execute dangerous operations
        document.addEventListener('DOMContentLoaded', function() {
            showDebug('Application started in DEBUG mode');
            showDebug(`Connecting to database at ${DB_CONFIG.host}:${DB_CONFIG.port}`);
            console.log('🚨 WARNING: This application is running in debug mode with exposed credentials!');
        });
    </script>
</body>
</html>
</file>

<file path="vulnerabilities.html">
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vulnerability Testing - Company Portal</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .vulnerability { margin: 15px 0; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; }
        .critical { background: #f8d7da; border-left-color: #dc3545; }
        .high { background: #ffeaa7; border-left-color: #fd79a8; }
        .medium { background: #d4edda; border-left-color: #28a745; }
        .test-url { font-family: monospace; background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚨 Security Vulnerability Test Cases</h1>
        <p>This page demonstrates various security vulnerabilities for testing purposes.</p>
        
        <div class="vulnerability critical">
            <h3>SQL Injection</h3>
            <p><strong>Test URL:</strong> <span class="test-url">?q=test' OR 1=1 --</span></p>
            <p>Test SQL injection in search parameters. Try payloads like:</p>
            <ul>
                <li>' OR 1=1 --</li>
                <li>' UNION SELECT password FROM users --</li>
                <li>'; DROP TABLE users; --</li>
            </ul>
        </div>
        
        <div class="vulnerability critical">
            <h3>Cross-Site Scripting (XSS)</h3>
            <p><strong>Test URL:</strong> <span class="test-url">?msg=&lt;script&gt;alert(1)&lt;/script&gt;</span></p>
            <p>Test XSS in comment and search fields. Try payloads like:</p>
            <ul>
                <li>&lt;script&gt;alert(1)&lt;/script&gt;</li>
                <li>&lt;img src=x onerror=alert(1)&gt;</li>
                <li>&lt;svg onload=alert(1)&gt;</li>
            </ul>
        </div>
        
        <div class="vulnerability high">
            <h3>Directory Traversal</h3>
            <p><strong>Test URL:</strong> <span class="test-url">?path=../../../etc/passwd</span></p>
            <p>Test directory traversal in file access. Try paths like:</p>
            <ul>
                <li>../../../etc/passwd</li>
                <li>..\\..\\..\\windows\\system32\\drivers\\etc\\hosts</li>
                <li>../../../../proc/version</li>
            </ul>
        </div>
        
        <div class="vulnerability high">
            <h3>Authentication Bypass</h3>
            <p>Test various authentication bypass methods:</p>
            <ul>
                <li>Header injection: X-Admin-Override: true</li>
                <li>Parameter pollution: ?admin=false&admin=true</li>
                <li>JWT none algorithm</li>
                <li>SQL injection in login: admin' OR '1'='1' --</li>
            </ul>
        </div>
        
        <div class="vulnerability medium">
            <h3>Rate Limiting</h3>
            <p>Test rate limiting on login and search endpoints:</p>
            <ul>
                <li>Brute force login attempts</li>
                <li>Unlimited search requests</li>
                <li>No account lockout</li>
            </ul>
        </div>
        
        <div class="vulnerability medium">
            <h3>Information Disclosure</h3>
            <p>Test information disclosure through:</p>
            <ul>
                <li>Error messages with stack traces</li>
                <li>Debug endpoints</li>
                <li>Version disclosure headers</li>
                <li>GraphQL introspection</li>
            </ul>
        </div>
        
        <div class="vulnerability medium">
            <h3>Insecure File Access</h3>
            <p>Test access to sensitive files:</p>
            <ul>
                <li>/.env - Environment variables</li>
                <li>/backup.sql - Database backup</li>
                <li>/admin/users.txt - User credentials</li>
                <li>/logs/error.log - Error logs</li>
                <li>/wp-config.php - WordPress config</li>
            </ul>
        </div>
        
        <h2>🔍 Testing Instructions</h2>
        <ol>
            <li>Deploy this site to a public URL</li>
            <li>Run your security scanner against the deployed site</li>
            <li>Verify that all vulnerabilities are detected</li>
            <li>Test each endpoint and vulnerability manually</li>
        </ol>
        
        <h2>⚠️ Important Notes</h2>
        <p><strong>This is a deliberately vulnerable application for testing purposes only.</strong></p>
        <p>Do not use any of these patterns in production code!</p>
    </div>
</body>
</html>
</file>

<file path="README.md">
# Vulnerable Test Site

This is a **deliberately vulnerable** web application created to test database exposure detection capabilities.

## 🚨 VULNERABILITIES INCLUDED

### 1. **Exposed Database Credentials**
- Hardcoded Supabase URLs and API keys in client-side JavaScript
- Service role key exposed (critical vulnerability)
- Database connection details in plain text

### 2. **Configuration Exposure**
- `.env` file accessible via web
- `config.json` with sensitive data
- Debug mode enabled with stack traces

### 3. **API Endpoints**
- Direct database queries without authentication
- Exposed admin endpoints
- Permissive CORS settings

## 🎯 WHAT SCANNER SHOULD DETECT

Our scanner modules should find:

- **`runTrufflehog`**: Hardcoded secrets in source code
- **`runDocumentExposure`**: `.env` and `config.json` files
- **`runEndpointDiscovery`**: API endpoints and GraphQL
- **`runDbPortScan`**: Database connection attempts
- **`runNuclei`**: SQL injection, XSS, directory traversal
- **`runTechStackScan`**: WordPress, Node.js, framework detection
- **`runRateLimitScan`**: Brute force vulnerabilities

## 🚀 DEPLOYMENT

1. Copy entire `vulnerable-test-site` folder to new repo
2. Deploy to Vercel/Netlify (static site)
3. Get domain name
4. Run scanner against it

## ⚠️ WARNING

This site is **intentionally vulnerable** for testing purposes only. 
DO NOT use any of these patterns in production code!

## Test Commands

Once deployed, test with:
```bash
curl -X POST https://dealbrief-scanner.fly.dev/scan \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Vulnerable Test Site", "domain": "your-domain.vercel.app"}'
```
</file>

</files>

