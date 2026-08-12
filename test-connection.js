require('dotenv').config();
const axios = require('axios');
const http = require('http');
const https = require('https');

/**
 * Connectivity check for Plex and Jellyfin, forcing IPv4.
 * Reads credentials from .env / the environment — never hard-code them here,
 * this file ships inside the Docker image.
 *
 *   node test-connection.js
 */

// Force IPv4 by configuring http agent
const httpAgent = new http.Agent({ family: 4 });
const httpsAgent = new https.Agent({ family: 4 });

async function testConnections() {
  console.log('Testing direct axios connections (forcing IPv4)...\n');

  // Test Plex
  if (process.env.PLEX_URL && process.env.PLEX_TOKEN) {
    console.log(`Testing Plex at ${process.env.PLEX_URL}...`);
    try {
      const plexResponse = await axios.get(process.env.PLEX_URL, {
        params: { 'X-Plex-Token': process.env.PLEX_TOKEN },
        timeout: 5000,
        httpAgent,
        httpsAgent
      });
      console.log('✓ Plex connection successful');
      console.log('  Status:', plexResponse.status);
    } catch (error) {
      console.log('✗ Plex connection failed');
      console.log('  Error:', error.message);
      console.log('  Code:', error.code);
    }
  } else {
    console.log('⊘ Plex not configured (set PLEX_URL and PLEX_TOKEN)');
  }

  console.log('');

  // Test Jellyfin
  if (process.env.JELLYFIN_URL && process.env.JELLYFIN_API_KEY) {
    console.log(`Testing Jellyfin at ${process.env.JELLYFIN_URL}...`);
    try {
      const jellyfinResponse = await axios.get(`${process.env.JELLYFIN_URL.replace(/\/$/, '')}/System/Info`, {
        params: { 'api_key': process.env.JELLYFIN_API_KEY },
        timeout: 5000,
        httpAgent,
        httpsAgent
      });
      console.log('✓ Jellyfin connection successful');
      console.log('  Status:', jellyfinResponse.status);
    } catch (error) {
      console.log('✗ Jellyfin connection failed');
      console.log('  Error:', error.message);
      console.log('  Code:', error.code);
    }
  } else {
    console.log('⊘ Jellyfin not configured (set JELLYFIN_URL and JELLYFIN_API_KEY)');
  }
}

testConnections();
