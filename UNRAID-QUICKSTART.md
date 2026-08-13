# LivePoster - Unraid Quick Start Guide

## Prerequisites

- Unraid 6.9 or later
- At least one media system (Kaleidescape, Plex, or Jellyfin)
- TMDb API key and read token (free from https://www.themoviedb.org/settings/api)

Nothing needs to be built or copied to your server — LivePoster is published as
a prebuilt image on Docker Hub. See
[Building it yourself](#appendix-building-the-image-yourself) if you'd rather
build from source.

## Installation Steps

### Step 1: Create the Container

1. Go to the **Docker** tab in Unraid
2. Click **Add Container**
3. Fill in the following:

**Basic Settings:**
- Name: `liveposter`
- Repository: `drgonzo65/liveposter:latest`
- Icon URL: `https://raw.githubusercontent.com/DrGonzo65/liveposter/master/icon.png`

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
- `TMDB_READ_TOKEN` = `your-tmdb-read-token`
- `OMDB_API_KEY` = `your-omdb-api-key` (optional)
- `PLEX_URL` = `http://192.168.1.60:32400` (optional)
- `PLEX_TOKEN` = `your-plex-token` (optional)
- `JELLYFIN_URL` = `http://192.168.1.61:8096` (optional)
- `JELLYFIN_API_KEY` = `your-jellyfin-key` (optional)

4. Click **Apply**. Unraid pulls the image and starts the container.

> Not sure which Kaleidescape address goes where? A movie server and a player
> answer different things, and getting them backwards means the slideshow works
> but "Now Playing" never appears. [SETUP.md](SETUP.md#4-kaleidescape-which-address-goes-where)
> has commands that identify each device.

### Step 2: Access and Configure

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

### TMDb (Required — you need **both** values)
1. Create account at https://www.themoviedb.org/
2. Go to Settings → API
3. Request an API key (choose "Developer")
4. Copy **both**: the "API Key (v3 auth)" → `TMDB_API_KEY`, and the
   "API Read Access Token (v4 auth)" → `TMDB_READ_TOKEN`. LivePoster needs
   both, and will keep showing the Setup screen if either is missing.

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

In the Unraid Docker tab, click the LivePoster icon → **Force Update**. That's it.

Your settings and metadata cache live in the mapped `/app/.cache` volume, so
they survive updates.

From the command line:

```bash
docker pull drgonzo65/liveposter:latest
```

Then restart the container from the Unraid UI.

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
- Review [DOCKER.md](DOCKER.md) for more detailed information
- Open an issue: https://github.com/DrGonzo65/liveposter/issues

## Using with Other Displays

LivePoster works great with:
- Dedicated tablets or iPads mounted near your theater
- Raspberry Pi with browser in kiosk mode
- Any computer with a web browser
- Cast to Chromecast or similar (experimental)

Just navigate to `http://your-unraid-ip:3000` from any device on your network!

## Appendix: Building the Image Yourself

Only needed if you've modified the source or want to run your own build. The
published image covers the normal case.

1. SSH into Unraid and copy the project there:
```bash
mkdir -p /mnt/user/appdata/liveposter-src
cd /mnt/user/appdata/liveposter-src
git clone https://github.com/DrGonzo65/liveposter.git .
```

2. Build it:
```bash
docker build -t liveposter:latest .
```

3. Create the container exactly as in Step 1, but set **Repository** to
   `liveposter:latest` instead of `drgonzo65/liveposter:latest`.

To update afterwards, `git pull` and rebuild — Force Update won't help, since
there's no registry to pull from.
