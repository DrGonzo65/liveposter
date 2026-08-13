# LivePoster Development Session Summary

**Date:** January 24, 2026
**Session Duration:** Extended development session
**Docker Image:** drgonzo65/liveposter:latest

## Major Features & Improvements Added

### 1. High-Resolution Poster Support
- Upgraded poster URLs from w500 to **w780** (780px)
- Upgraded posterUrlLarge to **original** (full resolution, typically 2000px+)
- Upgraded backdrop to **original** resolution
- Prioritized Kaleidescape native cover art (highest quality)
- Added image rendering optimizations for better quality

### 2. Persistent Settings (Docker-Friendly)
- Settings now saved to `.cache/settings.json` instead of `.env`
- **Survives Docker container updates**
- Priority: Persistent settings → Environment variables → Defaults

### 3. MPAA Rating Filters
- Added content filtering by MPAA rating (G, PG, PG-13, R, NC-17, NR)
- Configurable through Settings UI
- **Only affects slideshow** (not active playback)
- Filters apply across all sources (Kaleidescape, Plex, Jellyfin)

### 4. Setup Screen & Progress Logs
- **Setup Required screen** when services/TMDb not configured
- Shows what's missing with clear instructions
- Link to settings with auto-refresh
- **Live progress logs** during startup showing TMDb enrichment
- Console-style log display with last 10 messages

### 5. Image Preloading System
- Images fully load **before** text updates
- Prevents text appearing before poster
- Parallel loading of poster + backdrop
- Smooth synchronized transitions

### 6. Settings UI Improvements
- Added TMDb Read Token field (was missing)
- Changed time intervals from milliseconds to **seconds** (user-friendly)
- Added Display Scale slider (0.5x - 3.0x)
- Added "Clear Cache & Restart" button
- Added Content Filters section for MPAA ratings

### 7. Kaleidescape Playback Detection Fixes
- Added auto-reconnect on connection loss
- Fixed title capture from CONTENT_DETAILS
- Added content type detection
- Enhanced debug logging
- Ensured cover art is properly passed through
- Fixed "Now Playing" detection and display

### 8. Error Handling & Stability
- Added 10-second timeout to all TMDb API calls
- Added 30-second timeout per movie enrichment
- Better error handling during enrichment (continues on failure)
- Error counting and reporting
- Server startup no longer hangs on API issues

## Configuration Changes

### New Environment Variables
```bash
TMDB_READ_TOKEN=<token>        # Now exposed in settings UI
DISPLAY_SCALE=1.3              # Adjustable text scaling
ALLOWED_RATINGS=G,PG,PG-13,R   # Content filtering (stored in settings.json)
```

### File Structure Changes
```
.cache/
  ├── movies.json          # TMDb enriched metadata cache
  └── settings.json        # Persistent settings (NEW - Docker-safe)

public/
  ├── rotten-tomatoes.svg  # Downloaded RT icon (replaced emoji)
  └── ...
```

## Technical Improvements

### API Optimization
- Batch size: 5 movies per batch
- Delay between batches: 200ms
- Timeout per request: 10 seconds
- Timeout per movie: 30 seconds
- Total failure tolerance with graceful degradation

### Image Quality
- Using highest available resolution from TMDb
- Prioritizing Kaleidescape native art (best quality)
- CSS image-rendering optimizations
- Display limitation: 1920x1080 @ 51 PPI (hardware constraint)

### State Management
- Server start time tracking for auto-reload
- Client load time comparison
- Automatic page refresh on server restart
- Progress log buffering (last 50 logs, display 10)

## Bug Fixes

1. **Apostrophes displaying as `&apos;`**
   - Added HTML entity decoding across all text fields

2. **Settings wiped on Docker update**
   - Moved from .env to .cache/settings.json (persistent volume)

3. **Server startup hangs**
   - Added comprehensive timeout and error handling

4. **Text loading before images**
   - Implemented proper image preloading with DOM onload wait

5. **Kaleidescape playback not detected**
   - Fixed title capture, added auto-reconnect, enhanced state tracking

6. **Display scale resetting**
   - Moved to persistent storage, updates in-memory config

7. **Poster width padding**
   - Changed from 90% to 100% width

## Docker Deployment

### Building
```bash
docker buildx build --platform linux/amd64 -t drgonzo65/liveposter:latest --push .
```

### Running on Unraid
```
Repository: drgonzo65/liveposter:latest
Network: Bridge
Port: 3000:3000

Volume Mappings:
  /app/.cache → /mnt/user/appdata/liveposter/cache

Environment Variables:
  KALEIDESCAPE_HOST=192.168.1.50
  KALEIDESCAPE_PORT=10000
  JELLYFIN_URL=http://192.168.1.61:8096
  JELLYFIN_API_KEY=<key>
  TMDB_API_KEY=<key>
  TMDB_READ_TOKEN=<token>
  OMDB_API_KEY=<key>
  POLL_INTERVAL=10000
  SLIDESHOW_INTERVAL=30000
  DISPLAY_SCALE=1.3
```

## Known Limitations

1. **Display Resolution**
   - 43" @ 1920x1080 = ~51 PPI
   - Even highest quality posters will show some grain at this pixel density
   - Normal viewing distance (6-8 feet) minimizes visibility
   - Hardware limitation - would need 4K display for significant improvement

2. **TMDb Source Quality**
   - "Original" resolution varies by what's uploaded to TMDb
   - Typically 2000-3000px wide
   - Some older films have lower quality source images

## File Changes Summary

### Modified Files
- `server.js` - Settings persistence, progress logging, health endpoint
- `public/app.js` - Image preloading, setup screen, HTML decoding
- `public/index.html` - Added logs container, setup message area
- `public/style.css` - Image quality, log styling, poster width
- `public/manage.html` - TMDb token field, rating filters, cache button
- `public/manage.js` - Settings handling, rating checkboxes
- `lib/monitor.js` - Rating filters, Kaleidescape auto-reconnect, debug logs
- `lib/kaleidescape.js` - Title/type capture, improved state tracking
- `lib/tmdb.js` - Timeout handling, error recovery, higher resolutions

### New Files
- `public/rotten-tomatoes.svg` - Official RT icon

## Testing Checklist

- [x] TMDb metadata enrichment completes successfully
- [x] Settings persist across Docker updates
- [x] MPAA rating filters work correctly
- [x] Kaleidescape playback detection works
- [x] Images load before text updates
- [x] Setup screen appears when unconfigured
- [x] Progress logs display during startup
- [x] Cache clear button works
- [x] Auto-refresh on server restart
- [x] High-resolution posters display

## Future Considerations

1. **4K Display Support** - Would significantly improve image quality
2. **AI Upscaling** - Could improve poster quality but requires server processing
3. **Custom Poster Sources** - Allow manual high-res poster uploads
4. **Genre Filters** - Similar to rating filters but for genres
5. **Multiple Display Support** - Different settings per display

## Session End State

- All features working and tested
- Docker image published: `drgonzo65/liveposter:latest`
- Settings properly persisting
- Kaleidescape playback detection functional
- Image quality optimized within hardware constraints
