require('dotenv').config();
const { URL } = require('url');
const http = require('http');

/**
 * Same connectivity check as test-connection.js, using Node's native http
 * module instead of axios — useful for isolating agent/DNS problems.
 * Credentials come from .env; never hard-code them here.
 */

function testNativeHttp(host, port, path, name) {
  return new Promise((resolve) => {
    console.log(`Testing ${name}...`);

    const options = {
      hostname: host,
      port: port,
      path: path,
      method: 'GET',
      family: 4, // Force IPv4
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      console.log(`✓ ${name} connection successful`);
      console.log(`  Status: ${res.statusCode}`);
      resolve(true);
    });

    req.on('error', (error) => {
      console.log(`✗ ${name} connection failed`);
      console.log(`  Error: ${error.message}`);
      console.log(`  Code: ${error.code}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`✗ ${name} connection timeout`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function test() {
  console.log('Testing with native Node.js http module...\n');

  if (process.env.PLEX_URL && process.env.PLEX_TOKEN) {
    const plex = new URL(process.env.PLEX_URL);
    await testNativeHttp(plex.hostname, plex.port || 32400,
      `/?X-Plex-Token=${encodeURIComponent(process.env.PLEX_TOKEN)}`, 'Plex');
  } else {
    console.log('⊘ Plex not configured (set PLEX_URL and PLEX_TOKEN)');
  }

  console.log('');

  if (process.env.JELLYFIN_URL && process.env.JELLYFIN_API_KEY) {
    const jellyfin = new URL(process.env.JELLYFIN_URL);
    await testNativeHttp(jellyfin.hostname, jellyfin.port || 8096,
      `/System/Info?api_key=${encodeURIComponent(process.env.JELLYFIN_API_KEY)}`, 'Jellyfin');
  } else {
    console.log('⊘ Jellyfin not configured (set JELLYFIN_URL and JELLYFIN_API_KEY)');
  }
}

test();
