const http = require('http');
const https = require('https');

const server = http.createServer((req, res) => {
  const options = {
    hostname: 'scanner-frontend-242181373909.us-central1.run.app',
    port: 443,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'scanner-frontend-242181373909.us-central1.run.app',
      'Authorization': 'Bearer ' + process.env.TOKEN
    }
  };

  const proxy = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxy, { end: true });
});

server.listen(3000, () => {
  console.log('Proxy running on http://localhost:3000');
  console.log('Frontend will be accessible without auth!');
});