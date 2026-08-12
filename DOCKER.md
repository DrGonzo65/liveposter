# LivePoster Docker Deployment

## Quick Start with Docker Compose

1. **Clone the repository** or copy all files to your desired location

2. **Create a `.env` file** with your configuration (or use the settings UI after starting):
```bash
# Kaleidescape Configuration
KALEIDESCAPE_HOST=192.168.1.50
KALEIDESCAPE_PORT=10000

# Plex Configuration (optional)
PLEX_URL=http://192.168.1.60:32400
PLEX_TOKEN=your-plex-token

# Jellyfin Configuration (optional)
JELLYFIN_URL=http://192.168.1.60:8096
JELLYFIN_API_KEY=your-jellyfin-key

# TMDb Configuration
TMDB_API_KEY=your-tmdb-key

# OMDb Configuration (optional - for Rotten Tomatoes)
OMDB_API_KEY=your-omdb-key

# Polling Settings
POLL_INTERVAL=10000
SLIDESHOW_INTERVAL=10000
```

3. **Build and run**:
```bash
docker-compose up -d
```

4. **Access the application**:
- Main display: http://your-server-ip:3000
- Management interface: http://your-server-ip:3000/manage.html

## Unraid Deployment

### Method 1: Docker Compose (Recommended)

1. Install the "Compose Manager" plugin from Community Applications
2. Copy the entire project folder to your Unraid server (e.g., `/mnt/user/appdata/liveposter`)
3. Create or edit the `.env` file with your settings
4. In Compose Manager, add the compose file location
5. Start the stack

### Method 2: Unraid Docker Template

Add a new container in Unraid's Docker tab with these settings:

**Basic Settings:**
- **Name**: `liveposter`
- **Repository**: `liveposter:latest` (after building locally)
- **Network Type**: `Bridge`
- **Port Mapping**: `3000` → `3000` (Container Port → Host Port)

**Volume Mappings:**
- **Container Path**: `/app/.cache`
  - **Host Path**: `/mnt/user/appdata/liveposter/cache`
  - **Access Mode**: `Read/Write`
  - **Description**: Persistent metadata cache

**Environment Variables:**
- `KALEIDESCAPE_HOST` = `192.168.1.50`
- `KALEIDESCAPE_PORT` = `10000`
- `PLEX_URL` = `http://192.168.1.60:32400` (optional)
- `PLEX_TOKEN` = `your-token` (optional)
- `JELLYFIN_URL` = `http://192.168.1.60:8096` (optional)
- `JELLYFIN_API_KEY` = `your-key` (optional)
- `TMDB_API_KEY` = `your-key`
- `OMDB_API_KEY` = `your-key` (optional)
- `POLL_INTERVAL` = `10000`
- `SLIDESHOW_INTERVAL` = `10000`

### Building the Image on Unraid

1. SSH into your Unraid server
2. Navigate to the project directory:
```bash
cd /mnt/user/appdata/liveposter
```
3. Build the Docker image:
```bash
docker build -t liveposter:latest .
```

## Configuration via Web UI

After starting the container, you can also manage all settings through the web interface:

1. Open http://your-server-ip:3000/manage.html
2. Click the "⚙️ Settings" button
3. Configure all API keys and endpoints
4. Save settings
5. Restart the container for changes to take effect

## Volume Mounts

### Required:
- `/app/.cache` - Stores enriched movie metadata to speed up startup

### Optional:
- `/app/.env` - Mount your .env file (read-only) if you prefer file-based configuration over environment variables

## Network Requirements

The container needs network access to:
- Your Kaleidescape system (typically on local network)
- Your Plex server (if configured)
- Your Jellyfin server (if configured)
- External APIs: TheMovieDB (api.themoviedb.org), OMDb (www.omdbapi.com)

Use `network_mode: bridge` or `host` depending on your setup. Bridge mode is recommended for Unraid.

## Updating the Container

1. Stop the container
2. Rebuild the image:
```bash
docker-compose build --no-cache
docker-compose up -d
```

Or if using Unraid Docker UI:
```bash
docker stop liveposter
docker rm liveposter
docker build -t liveposter:latest .
# Then recreate the container via Unraid UI
```

## Troubleshooting

### Container won't start
- Check logs: `docker logs liveposter`
- Verify all required environment variables are set
- Ensure port 3000 is not already in use

### Can't connect to Kaleidescape/Plex/Jellyfin
- Verify the container can reach your media servers (check network settings)
- For host networking, use: `network_mode: host` in docker-compose.yml
- Ensure firewall rules allow access

### Metadata not persisting
- Verify the cache volume is properly mounted
- Check permissions on `/mnt/user/appdata/liveposter/cache`

### Settings not saving
- Ensure the .env volume is mounted with read/write access if using file-based config
- Alternatively, use environment variables in docker-compose.yml

## Support

For issues or questions, check the logs:
```bash
docker logs liveposter
```

Or access the container shell:
```bash
docker exec -it liveposter sh
```
