/**
 * Codespaces Metro Proxy
 *
 * Sits on port 8081 (the Codespaces-exposed port) and forwards to Metro on
 * port 8082. Rewrites bundle/asset URLs in manifest responses so the phone
 * receives `https://[hostname]/...` instead of `http://[hostname]:8082/...`
 * which the Codespaces HTTPS proxy can then serve correctly.
 *
 * Usage: node codespaces-proxy.js <public-hostname>
 * e.g.:  node codespaces-proxy.js urban-space-rotary-phone-pjv4jwrpvj5637rjj-8081.app.github.dev
 */

const http = require('http');
const net  = require('net');

const PUBLIC_HOST = process.argv[2] || 'localhost';
const LISTEN_PORT = 8081;
const METRO_PORT  = 8082;

// Pattern to rewrite in manifest JSON bodies.
// Metro generates: http://<PUBLIC_HOST>:8082/ or http://<PUBLIC_HOST>:8081/
// We want:         https://<PUBLIC_HOST>/
function rewriteUrls(text) {
  return text
    .replace(new RegExp(`http://${escapeRegex(PUBLIC_HOST)}:\\d+/`, 'g'), `https://${PUBLIC_HOST}/`)
    .replace(/"hostUri":"[^"]*"/, `"hostUri":"${PUBLIC_HOST}"`)
    .replace(/"debuggerHost":"[^"]*"/, `"debuggerHost":"${PUBLIC_HOST}"`);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const server = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: METRO_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${METRO_PORT}` },
  };

  const proxy = http.request(options, (metroRes) => {
    const contentType = metroRes.headers['content-type'] || '';
    const isManifest = contentType.includes('json') || req.url === '/' || req.url === '';

    if (isManifest) {
      // Buffer the response, rewrite URLs, then send
      let body = '';
      metroRes.setEncoding('utf8');
      metroRes.on('data', chunk => { body += chunk; });
      metroRes.on('end', () => {
        const rewritten = rewriteUrls(body);
        const headers = {
          ...metroRes.headers,
          'content-length': Buffer.byteLength(rewritten, 'utf8'),
        };
        res.writeHead(metroRes.statusCode, headers);
        res.end(rewritten);
      });
    } else {
      // Stream through unchanged
      res.writeHead(metroRes.statusCode, metroRes.headers);
      metroRes.pipe(res);
    }
  });

  proxy.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502);
    res.end('Metro not reachable: ' + err.message);
  });

  req.pipe(proxy);
});

// Forward WebSocket connections (HMR / live reload)
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(METRO_PORT, '127.0.0.1', () => {
    upstream.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n'
    );
    upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  upstream.on('error', (err) => {
    console.error('WS proxy error:', err.message);
    socket.destroy();
  });
});

server.listen(LISTEN_PORT, () => {
  console.log(`Codespaces Metro proxy running`);
  console.log(`  Listening : http://localhost:${LISTEN_PORT}`);
  console.log(`  Metro     : http://localhost:${METRO_PORT}`);
  console.log(`  Public URL: https://${PUBLIC_HOST}/`);
  console.log('');
  console.log('Open Expo Go → "Enter URL manually" and paste:');
  console.log(`  https://${PUBLIC_HOST}/`);
});
