#!/usr/bin/env node
/**
 * start-backend.js
 *
 * Starts the MuZalkin backend server + creates a public tunnel.
 * Automatically updates mobile/.env with the tunnel URL.
 *
 * Usage:  node start-backend.js
 */

const { spawn }  = require('child_process');
const localtunnel = require('/opt/node22/lib/node_modules/localtunnel');
const fs          = require('fs');
const path        = require('path');

const PORT    = 3001;
const ENV_FILE = path.join(__dirname, 'mobile', '.env');

// ── 1. Start backend server ─────────────────────────────────────────────────

console.log('🚀 Starting MuZalkin backend on port', PORT, '...');

const backendProc = spawn('node', ['server.js'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
  env: { ...process.env },
});

backendProc.on('error', (err) => {
  console.error('❌ Backend failed to start:', err.message);
  process.exit(1);
});

// ── 2. Wait for backend to be ready, then open tunnel ───────────────────────

const http = require('http');

function waitForBackend(retries = 15) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(`http://localhost:${PORT}/health`, (res) => {
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.end();
    };
    let tries = 0;
    const retry = () => {
      if (++tries >= retries) return reject(new Error('Backend not ready'));
      setTimeout(attempt, 500);
    };
    attempt();
  });
}

async function main() {
  try {
    await waitForBackend();
    console.log('✅ Backend is ready\n');
  } catch {
    console.error('❌ Backend did not start in time');
    process.exit(1);
  }

  // ── 3. Open tunnel ──────────────────────────────────────────────────────

  console.log('🔗 Opening public tunnel...');

  let tunnel;
  try {
    tunnel = await localtunnel({ port: PORT, subdomain: 'muzalkin-api-3001' });
  } catch {
    // Subdomain taken — get a random URL
    tunnel = await localtunnel({ port: PORT });
  }

  const tunnelUrl = tunnel.url;
  console.log('🌍 Backend tunnel URL:', tunnelUrl);

  // ── 4. Update mobile/.env ──────────────────────────────────────────────

  if (fs.existsSync(ENV_FILE)) {
    let env = fs.readFileSync(ENV_FILE, 'utf8');
    if (env.includes('EXPO_PUBLIC_API_URL=')) {
      env = env.replace(/EXPO_PUBLIC_API_URL=.*/g, `EXPO_PUBLIC_API_URL=${tunnelUrl}`);
    } else {
      env += `\nEXPO_PUBLIC_API_URL=${tunnelUrl}\n`;
    }
    fs.writeFileSync(ENV_FILE, env);
    console.log('✅ Updated mobile/.env with tunnel URL\n');
  }

  console.log('─────────────────────────────────────────────');
  console.log('✅ Backend tunnel is live:', tunnelUrl);
  console.log('');
  console.log('Now restart Expo:');
  console.log('  cd mobile && npx expo start --tunnel --clear');
  console.log('─────────────────────────────────────────────');

  tunnel.on('close', () => {
    console.warn('⚠️  Tunnel closed — restarting...');
    process.exit(1); // Let the user restart the script
  });

  tunnel.on('error', (err) => {
    console.error('⚠️  Tunnel error:', err.message);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
