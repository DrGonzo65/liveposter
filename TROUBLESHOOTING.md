# Troubleshooting Guide

## Common Issues and Solutions

### Plex Errors

#### "Error getting Plex sessions: getaddrinfo ENOTFOUND"
**Cause**: The Plex URL is incorrect or not reachable.

**Solutions**:
1. Verify `PLEX_URL` in your `.env` file is correct
2. Make sure it includes the protocol (http:// or https://)
3. Test the URL by opening it in a browser from the same machine
4. Check that Plex Media Server is running
5. Verify the port (default is 32400)

Example valid URLs:
```
PLEX_URL=http://192.168.1.101:32400
PLEX_URL=http://localhost:32400
PLEX_URL=https://plex.example.com:32400
```

#### "Error getting Plex sessions: Unauthorized"
**Cause**: Invalid Plex token.

**Solution**: Get a new Plex token:
1. Sign in to Plex Web App
2. Open any media item
3. Click "Get Info" or "..."
4. Click "View XML"
5. Look for `X-Plex-Token` in the URL
6. Copy the token value to your `.env` file

---

### Jellyfin Errors

#### "Error getting Jellyfin sessions: connect EHOSTUNREACH"
**Cause**: Cannot reach the Jellyfin server at the specified IP address.

**Solutions**:
1. Verify `JELLYFIN_URL` in your `.env` file is correct
2. Check that the Jellyfin server is running
3. Verify the IP address is reachable:
   ```bash
   ping 192.168.1.60
   ```
4. Check firewall rules aren't blocking port 8096
5. Make sure you're on the same network as the Jellyfin server

#### "Error getting Jellyfin sessions: connect ECONNREFUSED"
**Cause**: Jellyfin server is not running or wrong port.

**Solutions**:
1. Start your Jellyfin server
2. Verify the port (default is 8096)
3. Check Jellyfin server status in its dashboard

#### "Error getting Jellyfin sessions: Unauthorized"
**Cause**: Invalid API key.

**Solution**: Create a new API key:
1. Sign in to Jellyfin Dashboard
2. Go to Dashboard > API Keys
3. Click "+" to create a new key
4. Name it "LivePoster"
5. Copy the key to your `.env` file

---

### Kaleidescape Errors

#### "Kaleidescape error 004: Invalid device:/61"
**Cause**: Commands are being sent that aren't valid in the current player state.

**What it means**:
- This is normal when the Kaleidescape player is idle or in standby
- The player responds with error 004 when you query playback status but nothing is playing
- These errors are harmless and will be suppressed after the first occurrence

**Solution**: No action needed. When you start playing something on Kaleidescape, it should work correctly.

#### "Kaleidescape connection error: connect ECONNREFUSED"
**Cause**: Cannot connect to Kaleidescape player.

**Solutions**:
1. Verify `KALEIDESCAPE_HOST` IP address is correct
2. Verify `KALEIDESCAPE_PORT` is 10000 (default)
3. Check that the player is powered on
4. Ping the player to verify network connectivity:
   ```bash
   ping 192.168.1.51
   ```
5. Verify control protocol is enabled on the player

#### "Kaleidescape connection error: connect ETIMEDOUT"
**Cause**: Network timeout reaching the player.

**Solutions**:
1. Check network connectivity
2. Verify firewall isn't blocking port 10000
3. Make sure player and server are on the same network
4. Try accessing the player's web interface

---

### No Movies Showing in Slideshow

#### Library is empty
**Cause**: No movies loaded from any source.

**Solutions**:
1. Check server logs to see if libraries loaded successfully
2. Verify at least one media system is configured and connected
3. Check that your media libraries contain movies
4. For Kaleidescape: The library loads as you play content
5. Visit http://localhost:3000/api/library to check library status

---

### Frontend Not Loading

#### Blank screen or loading forever
**Solutions**:
1. Check browser console for errors (F12)
2. Verify the server is running
3. Check that port 3000 is accessible
4. Try refreshing the page (Cmd+R / Ctrl+R)
5. Check server logs for errors

#### Cannot connect to server
**Solutions**:
1. Verify the server is running: `npm start`
2. Check the correct URL: http://localhost:3000
3. If accessing remotely, use the server's IP address
4. Check firewall isn't blocking port 3000

---

## Enabling Debug Logging

To see more detailed information, you can modify the code to enable debug logging:

### Kaleidescape
In `lib/kaleidescape.js`, uncomment debug lines to see all protocol responses.

### Network Testing

Test Plex connection:
```bash
curl http://192.168.1.101:32400/status/sessions?X-Plex-Token=YOUR_TOKEN
```

Test Jellyfin connection:
```bash
curl http://192.168.1.60:8096/System/Info?api_key=YOUR_API_KEY
```

Test Kaleidescape connection:
```bash
telnet 192.168.1.51 10000
# Then type: 01
# Press Enter
# Should see device info response
```

---

## Still Having Issues?

1. Check the server logs carefully
2. Verify all configuration in `.env` file
3. Test each service individually using the API endpoints:
   - http://localhost:3000/api/status
   - http://localhost:3000/api/library
   - http://localhost:3000/api/health
4. Make sure all services are on the same network
5. Check firewall rules on both the server and media devices
