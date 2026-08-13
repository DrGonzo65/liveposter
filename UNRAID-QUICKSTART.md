# LivePoster - Unraid Quick Start Guide

## Prerequisites

- Unraid 6.9 or later
- At least one media system (Kaleidescape, Plex, or Jellyfin)
- TMDb API key (free from https://www.themoviedb.org/settings/api)

## Installation Steps

### Step 1: Copy Files to Unraid

1. SSH into your Unraid server or use the built-in terminal
2. Create the application directory:
```bash
mkdir -p /mnt/user/appdata/liveposter
cd /mnt/user/appdata/liveposter
```

3. Copy all LivePoster files to this directory (via SSH, SMB share, or your preferred method)

### Step 2: Build the Docker Image

```bash
cd /mnt/user/appdata/liveposter
docker build -t liveposter:latest .
```

This will take a few minutes on first build.

### Step 3: Create the Container

#### Option A: Using Unraid Docker UI (Recommended)

1. Go to Docker tab in Unraid
2. Click "Add Container"
3. Fill in the following:

**Basic Settings:**
- Name: `liveposter`
- Repository: `liveposter:latest`
- Icon URL: (leave blank or use your own)

**Network:**
- Network Type: `Bridge`

**Port Mappings:**
- Container Port: `3000` → Host Port: `3000`

**Path Mappings:**
- Container Path: `/app/.cache`
- Host Path: `/mnt/user/appdata/liveposter/cache`
- Access Mode: Read/Write

**Environment Variables:**
Add these variables (adjust values for your setup):
- `KALEIDESCAPE_PLAYER_HOST` = `192.168.1.50` (the **player** - answers play-status queries)
- `KALEIDESCAPE_PORT` = `10000`
- `KALEIDESCAPE_SERVER_HOST` = `192.168.1.51` (the **movie server** - serves the library page; omit if one device)
- `TMDB_API_KEY` = `your-tmdb-api-key`
- `OMDB_API_KEY` = `your-omdb-api-key` (optional)
- `PLEX_URL` = `http://192.168.1.60:32400` (optional)
- `PLEX_TOKEN` = `your-plex-token` (optional)
- `JELLYFIN_URL` = `http://192.168.1.60:8096` (optional)
- `JELLYFIN_API_KEY` = `your-jellyfin-key` (optional)

4. Click "Apply"

#### Option B: Using Docker Compose

1. Install "Compose Manager" plugin from Community Applications
2. Edit the `docker-compose.yml` file in `/mnt/user/appdata/liveposter`
3. Update environment variables with your settings
4. In Compose Manager, add the compose file and start the stack

### Step 4: Access and Configure

1. **Open the display:**
   - Navigate to: `http://your-unraid-ip:3000`
   - This is your poster display screen

2. **Configure via Settings UI:**
   - Navigate to: `http://your-unraid-ip:3000/manage.html`
   - Click "⚙️ Settings"
   - Enter all your API keys and system URLs
   - Click "Save Settings"
   - Restart the container

3. **Manage metadata:**
   - Use the management UI to review movie metadata
   - Fix any incorrect matches by searching TMDb
   - Enable/disable movies in the slideshow

## Getting API Keys

### TMDb API Key (Required)
1. Create account at https://www.themoviedb.org/
2. Go to Settings → API
3. Request an API key (choose "Developer")
4. Copy the "API Key (v3 auth)" value

### OMDb API Key (Optional - for Rotten Tomatoes)
1. Go to http://www.omdbapi.com/apikey.aspx
2. Select "FREE" tier
3. Enter your email and activate the key
4. Copy the API key from your email

### Plex Token (Optional)
1. Open Plex Web App
2. Play any media item
3. Click the "..." menu → "Get Info"
4. Click "View XML"
5. Look for `X-Plex-Token` in the URL

### Jellyfin API Key (Optional)
1. Open Jellyfin Dashboard
2. Go to Dashboard → API Keys
3. Click "+" to create new key
4. Name it "LivePoster" and save

## Updating the Container

When you pull new code or make changes:

```bash
cd /mnt/user/appdata/liveposter
docker stop liveposter
docker rm liveposter
docker build -t liveposter:latest .
# Then recreate container via UI or compose
```

## Accessing Logs

View container logs in Unraid:
```bash
docker logs liveposter
```

Or in Unraid Docker UI, click the container icon → Logs

## Troubleshooting

### Container won't start
- Check logs: `docker logs liveposter`
- Verify port 3000 isn't in use by another container
- Ensure cache directory exists and has proper permissions

### Can't access web interface
- Verify the container is running: `docker ps | grep liveposter`
- Check firewall settings
- Try accessing via Unraid IP: `http://unraid-ip:3000`

### No movies showing
- Check that at least one media system is configured
- Verify network connectivity to your media servers
- Check API keys are correct in Settings UI
- Review container logs for connection errors

### Media system not connecting
- For Kaleidescape: Verify IP and that control protocol is enabled
- For Plex: Ensure Plex server is running and token is valid
- For Jellyfin: Verify server is running and API key is correct
- Test connectivity: `docker exec liveposter ping your-media-server-ip`

## Tips for Unraid

1. **Pin the container** to keep it running after Unraid updates
2. **Set to autostart** so it starts when Unraid boots
3. **Use a fixed IP** for your media servers to avoid reconfiguration
4. **Create a backup** of `/mnt/user/appdata/liveposter/cache` with CA Backup plugin
5. **Monitor memory usage** - the cache can grow with large libraries

## Support

For issues or questions:
- Check the logs first
- Review DOCKER.md for more detailed information
- Open an issue on GitHub (if applicable)

## Using with Other Displays

LivePoster works great with:
- Dedicated tablets or iPads mounted near your theater
- Raspberry Pi with browser in kiosk mode
- Any computer with a web browser
- Cast to Chromecast or similar (experimental)

Just navigate to `http://your-unraid-ip:3000` from any device on your network!
