# LivePoster

A media poster display server that monitors your home theater systems (Kaleidescape, Plex, Jellyfin, Nvidia Shield) and displays movie/TV posters. When media is playing, it shows the current content. When idle, it cycles through your Kaleidescape library as a slideshow.

## Features

- **Real-time monitoring** of multiple media systems
- **Automatic detection** of currently playing content with progress bar
- **Priority system**: Kaleidescape > Plex > Jellyfin
- **Automatic slideshow** when idle (can enable/disable per movie)
- **Beautiful web-based display** interface
- **Management UI** for metadata review and correction
- **Settings UI** for easy configuration (no need to edit files)
- **Metadata caching** for fast startup times
- **TMDb & OMDb integration** for rich movie data and Rotten Tomatoes scores
- **Docker support** for easy deployment on Unraid
- Responsive design for any screen size
- Smooth transitions and animations

## Supported Systems

- **Kaleidescape** - TCP/IP control protocol integration
- **Plex** - Full API integration
- **Jellyfin** - Full API integration
- **Nvidia Shield** - Via Plex or Jellyfin client

## Installation

**New here? Start with [SETUP.md](SETUP.md)** — a step-by-step guide covering
credentials, working out which Kaleidescape address goes where, and first run.

### Option 1: Unraid (Community Applications)

Search for **LivePoster** in the Apps tab and click Install. All settings are
exposed as template fields; see [UNRAID-QUICKSTART.md](UNRAID-QUICKSTART.md).

### Option 2: Docker (Recommended elsewhere)

A prebuilt image is published, so there's nothing to compile:

```bash
docker run -d --name liveposter -p 3000:3000 \
  -v ./cache:/app/.cache --env-file .env \
  drgonzo65/liveposter:latest
```

Or with the included `docker-compose.yml`:

```bash
docker compose up -d
```

Then open http://localhost:3000, and configure via the settings UI at
http://localhost:3000/manage.html

See [DOCKER.md](DOCKER.md) for secrets, updating, and building your own image,
or [UNRAID-QUICKSTART.md](UNRAID-QUICKSTART.md) for Unraid.

### Option 3: Node.js

1. Install dependencies:
```bash
npm install
```

2. Copy the environment example file:
```bash
cp .env.example .env
```

3. Edit `.env` and configure your systems:
```bash
# Server Configuration
PORT=3000

# TheMovieDB - both values are required
TMDB_API_KEY=your_tmdb_api_key_here
TMDB_READ_TOKEN=your_tmdb_read_token_here

# Kaleidescape - PLAYER_HOST reports what's playing; SERVER_HOST holds the movies.
# Leave SERVER_HOST blank on an all-in-one system such as a Strato V.
KALEIDESCAPE_PLAYER_HOST=192.168.1.50
KALEIDESCAPE_PORT=10000
KALEIDESCAPE_SERVER_HOST=

# Plex Configuration
PLEX_URL=http://192.168.1.60:32400
PLEX_TOKEN=your_plex_token_here

# Jellyfin Configuration
JELLYFIN_URL=http://192.168.1.61:8096
JELLYFIN_API_KEY=your_jellyfin_api_key_here

# Polling interval in milliseconds (default: 10000 = 10 seconds)
POLL_INTERVAL=10000

# Idle slideshow interval in milliseconds (default: 30000 = 30 seconds)
SLIDESHOW_INTERVAL=30000
```

See [SETUP.md](SETUP.md) for how to obtain each credential.

## Getting API Keys

### Plex Token
1. Sign in to Plex Web App
2. Open any media item and click "Get Info" or "..."
3. Click "View XML"
4. Look for `X-Plex-Token` in the URL

Or visit: https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/

### Jellyfin API Key
1. Sign in to Jellyfin Dashboard
2. Go to Dashboard > API Keys
3. Click "+" to create a new API key
4. Name it "LivePoster" and save

### Kaleidescape

No authentication is required, but **which device you point at matters**:

- `KALEIDESCAPE_PLAYER_HOST` must be the **player** — it reports what's playing (port 10000)
- `KALEIDESCAPE_SERVER_HOST` must be the device **holding your movies** — a Terra
  movie server, or the same player on an all-in-one system such as a Strato V

On an all-in-one system, set `KALEIDESCAPE_PLAYER_HOST` and leave `KALEIDESCAPE_SERVER_HOST`
blank; it falls back to the same address.

Pointing `KALEIDESCAPE_PLAYER_HOST` at a movie server is the most common setup mistake —
the slideshow works but "Now Playing" never appears. See
[SETUP.md](SETUP.md#4-kaleidescape-which-address-goes-where) for commands that
identify each device.

## Usage

Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

Then open your browser to:
```
http://localhost:3000
```

## How It Works

1. **Monitoring**: The server polls all configured systems every 10 seconds (configurable)
2. **Priority**: If multiple systems are playing, it shows content in this order:
   - Kaleidescape (highest priority)
   - Plex
   - Jellyfin (lowest priority)
3. **Idle Mode**: When nothing is playing, it displays random posters from your Kaleidescape library
4. **Display**: The web interface automatically updates when playback state changes

## Web Interfaces

- **Main Display**: `http://localhost:3000` - The poster display
- **Management UI**: `http://localhost:3000/manage.html` - Review and fix movie metadata
- **Settings UI**: Click "⚙️ Settings" in management UI - Configure all API keys and systems

## API Endpoints

### Status & Library
- `GET /api/status` - Current playback state
- `GET /api/library?source=all` - Get library (sources: all, kaleidescape, plex, jellyfin)
- `GET /api/random?source=all` - Get random movie from library for slideshow
- `GET /api/config` - Server configuration
- `GET /api/health` - Health check
- `GET /api/loading` - Loading status during startup

### Metadata Management
- `GET /api/movies/all?source=all` - Get all movies with metadata quality indicators
- `GET /api/movies/search?title=MovieName&year=2020` - Search TMDb for alternative matches
- `POST /api/movies/update` - Update movie metadata with correct TMDb match
- `POST /api/movies/toggle-slideshow` - Enable/disable movie in slideshow

### Settings
- `GET /api/settings` - Get current configuration. API keys and tokens are returned masked, never in full
- `POST /api/settings` - Save configuration to `.cache/settings.json` (persists across container updates)

## Configuration

Configuration comes from environment variables (or the Settings UI, which
overrides them). Any variable can also be supplied as `<NAME>_FILE` pointing at a
file containing the value — see [Docker secrets](DOCKER.md#docker-secrets).

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default: 3000) |
| `TMDB_API_KEY` | TMDb API key, v3 auth — **required** |
| `TMDB_READ_TOKEN` | TMDb read access token, v4 auth — **required** |
| `OMDB_API_KEY` | OMDb key, for Rotten Tomatoes scores (optional) |
| `KALEIDESCAPE_PLAYER_HOST` | Kaleidescape **player** IP — reports what's playing |
| `KALEIDESCAPE_SERVER_HOST` | Device holding the movie library; blank = same as `KALEIDESCAPE_PLAYER_HOST` |
| `KALEIDESCAPE_PORT` | Control port (default: 10000) |
| `PLEX_URL` / `PLEX_TOKEN` | Plex server and token |
| `JELLYFIN_URL` / `JELLYFIN_API_KEY` | Jellyfin server and API key |
| `POLL_INTERVAL` | How often to check for playback (ms, default 10000) |
| `SLIDESHOW_INTERVAL` | How often to change slides when idle (ms, default 30000) |
| `DISPLAY_SCALE` | Text scaling for the display (default 1.0) |
| `KALEIDESCAPE_ENABLED` / `PLEX_ENABLED` / `JELLYFIN_ENABLED` | Set to `false` to switch a system off without clearing its settings (default on) |
| `KALEIDESCAPE_DEBUG` | Set to `1` to log every control-protocol message. Off by default — it's two lines per command per poll |

## Troubleshooting

### Kaleidescape not connecting
- Verify the IP address is correct
- Check that port 10000 is not blocked by firewall
- Ensure control protocol is enabled on your Kaleidescape player

### Plex not working
- Verify your Plex token is correct
- Make sure the Plex server URL is accessible from the machine running LivePoster
- Check that your Plex server is running

### Jellyfin not working
- Verify your API key is correct
- Ensure the Jellyfin URL is accessible
- Check that your Jellyfin server is running

### No posters showing
- Check the server logs for errors
- Verify at least one system is configured
- Make sure you have movies in your library

## Project Structure

```
liveposter/
├── lib/
│   ├── kaleidescape.js   # Kaleidescape TCP/IP control client
│   ├── plex.js           # Plex API integration
│   ├── jellyfin.js       # Jellyfin API integration
│   ├── tmdb.js           # TheMovieDB metadata enrichment
│   ├── omdb.js           # OMDb lookups (Rotten Tomatoes scores)
│   ├── cache.js          # Metadata cache manager
│   └── monitor.js        # Media monitoring service
├── public/
│   ├── index.html        # Poster display
│   ├── app.js            # Display logic
│   ├── style.css         # Styles
│   ├── manage.html       # Metadata manager + settings UI
│   └── manage.js         # Manager logic
├── .cache/               # Metadata cache + saved settings (mount this in Docker)
├── server.js             # Express server
├── package.json
├── .env.example
├── SETUP.md              # Full setup guide
├── DOCKER.md             # Docker / Unraid deployment
└── README.md
```

## Credits

Inspired by [posterr](https://github.com/petersem/posterr) by petersem.

## License

MIT
