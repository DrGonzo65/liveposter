# LivePoster Docker Deployment

LivePoster is published as a prebuilt image, so there's nothing to compile:

```bash
docker pull drgonzo65/liveposter:latest
```

## Quick Start with Docker Compose

1. **Create a `docker-compose.yml`**:

```yaml
services:
  liveposter:
    image: drgonzo65/liveposter:latest
    container_name: liveposter
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      # Metadata cache AND saved settings - map this to keep them across updates
      - ./cache:/app/.cache
    env_file: .env
```

2. **Create a `.env` file** alongside it (or configure through the settings UI
   after starting):
```bash
# Kaleidescape Configuration
# PLAYER_HOST answers play-status queries; SERVER_HOST is the movie server
# that serves the /movies library page. Omit SERVER_HOST if they are one device.
KALEIDESCAPE_PLAYER_HOST=192.168.1.50
KALEIDESCAPE_PORT=10000
KALEIDESCAPE_SERVER_HOST=192.168.1.51

# Plex Configuration (optional)
PLEX_URL=http://192.168.1.60:32400
PLEX_TOKEN=your-plex-token

# Jellyfin Configuration (optional)
JELLYFIN_URL=http://192.168.1.61:8096
JELLYFIN_API_KEY=your-jellyfin-key

# TMDb Configuration
TMDB_API_KEY=your-tmdb-key

# OMDb Configuration (optional - for Rotten Tomatoes)
OMDB_API_KEY=your-omdb-key

# Polling Settings
POLL_INTERVAL=10000
SLIDESHOW_INTERVAL=10000
```

3. **Start it**:
```bash
docker compose up -d
```

4. **Access the application**:
- Main display: http://your-server-ip:3000
- Management interface: http://your-server-ip:3000/manage.html

## Plain Docker

Without compose:

```bash
docker run -d \
  --name liveposter \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /path/to/liveposter/cache:/app/.cache \
  --env-file .env \
  drgonzo65/liveposter:latest
```

## Unraid Deployment

See [UNRAID-QUICKSTART.md](UNRAID-QUICKSTART.md) for the step-by-step version.
In short: **Add Container**, set Repository to `drgonzo65/liveposter:latest`,
map `/app/.cache` to somewhere under `/mnt/user/appdata/`, and add your
environment variables.

## Updating

```bash
docker compose pull && docker compose up -d
```

On Unraid, click the container icon → **Force Update**.

Your settings and metadata cache live in the mounted `/app/.cache` volume, so
they survive updates.

## Building the Image Yourself

Only needed if you've modified the source.

```bash
git clone https://github.com/DrGonzo65/liveposter.git
cd liveposter
docker build -t liveposter:latest .
```

Then use `liveposter:latest` in place of `drgonzo65/liveposter:latest`.

Multi-arch build and publish:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t <your-user>/liveposter:latest --push .
```

## Configuration via Web UI

After starting the container, you can also manage all settings through the web interface:

1. Open http://your-server-ip:3000/manage.html
2. Click the "⚙️ Settings" button
3. Configure all API keys and endpoints
4. Save settings
5. Restart the container for changes to take effect

## Docker Secrets

Any environment variable can instead be supplied as `<NAME>_FILE`, pointing at a
file that holds the value. `<NAME>_FILE` wins if both are set, and surrounding
whitespace is trimmed. This keeps credentials out of `docker inspect`, out of a
compose file you might commit, and out of the Unraid template:

```yaml
services:
  liveposter:
    environment:
      - JELLYFIN_API_KEY_FILE=/run/secrets/jellyfin_key
      - TMDB_READ_TOKEN_FILE=/run/secrets/tmdb_token
    secrets:
      - jellyfin_key
      - tmdb_token

secrets:
  jellyfin_key:
    file: ./secrets/jellyfin_key
  tmdb_token:
    file: ./secrets/tmdb_token
```

If a `_FILE` path can't be read, LivePoster logs the failure and falls back to
the plain variable rather than starting up misconfigured.

## Volume Mounts

### Required:
- `/app/.cache` - Stores enriched movie metadata **and saved settings** (`settings.json`). Settings saved from the web UI are written here only, so they survive container updates.

### Optional:
- `/app/.env` - Mount your .env file (read-only) if you prefer file-based configuration over environment variables

## Network Requirements

The container needs network access to:
- Your Kaleidescape system (typically on local network)
- Your Plex server (if configured)
- Your Jellyfin server (if configured)
- External APIs: TheMovieDB (api.themoviedb.org), OMDb (www.omdbapi.com)

Use `network_mode: bridge` or `host` depending on your setup. Bridge mode is recommended for Unraid.

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
