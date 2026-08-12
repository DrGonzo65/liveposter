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

### Option 1: Docker (Recommended for Unraid)

See [DOCKER.md](DOCKER.md) for complete Docker and Unraid deployment instructions.

**Quick Start:**
```bash
docker-compose up -d
```

Then access at http://localhost:3000 and configure via the settings UI at http://localhost:3000/manage.html

### Option 2: Node.js

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

# Kaleidescape Configuration
KALEIDESCAPE_HOST=192.168.1.100
KALEIDESCAPE_PORT=10000

# Plex Configuration
PLEX_URL=http://192.168.1.101:32400
PLEX_TOKEN=your_plex_token_here

# Jellyfin Configuration
JELLYFIN_URL=http://192.168.1.102:8096
JELLYFIN_API_KEY=your_jellyfin_api_key_here

# Polling interval in milliseconds (default: 10000 = 10 seconds)
POLL_INTERVAL=10000

# Idle slideshow interval in milliseconds (default: 30000 = 30 seconds)
SLIDESHOW_INTERVAL=30000
```

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
- Use the IP address of your Kaleidescape player
- Default port is 10000
- No authentication required

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
- `GET /api/settings` - Get current configuration
- `POST /api/settings` - Save configuration to .env file

## Configuration

All configuration is done through environment variables in the `.env` file:

- `PORT` - Server port (default: 3000)
- `KALEIDESCAPE_HOST` - Kaleidescape player IP address
- `KALEIDESCAPE_PORT` - Kaleidescape control port (default: 10000)
- `PLEX_URL` - Plex server URL
- `PLEX_TOKEN` - Plex authentication token
- `JELLYFIN_URL` - Jellyfin server URL
- `JELLYFIN_API_KEY` - Jellyfin API key
- `POLL_INTERVAL` - How often to check for playback (milliseconds)
- `SLIDESHOW_INTERVAL` - How often to change slides when idle (milliseconds)

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
│   ├── kaleidescape.js   # Kaleidescape TCP/IP client
│   ├── plex.js           # Plex API integration
│   ├── jellyfin.js       # Jellyfin API integration
│   └── monitor.js        # Media monitoring service
├── public/
│   ├── index.html        # Frontend HTML
│   ├── style.css         # Styles
│   └── app.js            # Frontend JavaScript
├── server.js             # Express server
├── package.json
├── .env.example
└── README.md
```

## Credits

Inspired by [posterr](https://github.com/petersem/posterr) by petersem.

## License

MIT
