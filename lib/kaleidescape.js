const net = require('net');
const EventEmitter = require('events');

// Protocol status codes we treat specially
const STATUS_INVALID_REQUEST = '010';  // command not supported by this device
const STATUS_STANDBY = '020';          // device asleep; supported but unavailable

/**
 * Kaleidescape TCP/IP Control Protocol Client
 * Protocol reference: Kaleidescape System Control Protocol Reference Manual
 *
 * Command format (sent by us): 01/SEQ/COMMAND_NAME:PARAMS:
 * Response format (from device): 01/SEQ/STATUS:RESPONSE_NAME:FIELD1:FIELD2:...:/CHECKSUM
 *   where STATUS is a 3-digit decimal: 000=success, 010=invalid request, etc.
 *   and /CHECKSUM at the end is numeric (ignored over TCP)
 *
 * Unsolicited events use '!' as the sequence: 01/!/000:PLAY_STATUS:...
 */
class KaleidescapeClient extends EventEmitter {
  constructor(host, port = 10000) {
    super();
    this.host = host;
    this.port = port;
    this.client = null;
    this.connected = false;
    this.buffer = '';
    this.seqNum = 0; // Sequence number 0-9, incremented per command
    this.currentState = {
      playing: false,
      contentTitle: null,
      contentHandle: null,
      contentType: null,
      coverArt: null,
      playStatus: null,
      playTime: null,
      titleLength: null
    };

    // Reported by GET_DEVICE_TYPE_NAME, e.g. "Player" or
    // "Terra Prime Movie Server (HDD)". A movie server has no playback zone
    // and rejects play-status queries - see playbackUnsupported below.
    this.deviceType = null;
    this.playbackUnsupported = false;

    // True while the player reports status 020. Normal overnight state, not a
    // fault - the poll loop keeps running so we notice when it wakes.
    this.standby = false;

    // Per-message protocol tracing. Off by default: it is two lines per command
    // per poll, which is thousands of lines a day in a container log.
    this.debug = process.env.KALEIDESCAPE_DEBUG === '1' ||
                 String(process.env.KALEIDESCAPE_DEBUG).toLowerCase() === 'true';

    // seq number -> command name, so a rejection can name the command it answers
    this.pendingCommands = {};

    // Library loading state
    this.movieLibrary = [];
    this.isLoadingLibrary = false;
  }

  /**
   * Open the control connection.
   * @param {number} connectTimeout - ms to wait for the TCP handshake before giving up.
   *   Without this the OS decides (~2 minutes on macOS), which stalls startup.
   */
  connect(connectTimeout = 5000) {
    return new Promise((resolve, reject) => {
      // Tear down any previous socket so repeated reconnect attempts don't leak
      if (this.client) {
        this.client.removeAllListeners();
        this.client.destroy();
        this.client = null;
      }

      // A socket can emit both 'error' and 'close'; settle the promise only once
      let settled = false;
      const settle = (fn, arg) => {
        if (settled) return;
        settled = true;
        fn(arg);
      };

      this.client = new net.Socket();
      this.client.setEncoding('utf8');
      this.client.setTimeout(connectTimeout);

      this.client.on('timeout', () => {
        // Only meaningful during the handshake; cleared once connected
        if (!this.connected) {
          const err = new Error(`Connection to ${this.host}:${this.port} timed out after ${connectTimeout}ms`);
          this.client.destroy();
          this.reportError(err);
          settle(reject, err);
        }
      });

      this.client.on('connect', () => {
        console.log(`Connected to Kaleidescape at ${this.host}:${this.port}`);
        this.connected = true;
        // Drop the handshake deadline — an idle control connection is normal
        this.client.setTimeout(0);

        setTimeout(() => {
          // Initialize: get device info, then enable automatic event push
          // ENABLE_EVENTS:1: causes the device to push all state changes automatically
          this.sendCommand('GET_DEVICE_INFO');
          // Identifies player vs movie server so misconfiguration is obvious
          this.sendCommand('GET_DEVICE_TYPE_NAME');
          this.sendCommand('ENABLE_EVENTS', '1');
          // Request current state immediately (don't wait for next poll)
          this.sendCommand('GET_PLAY_STATUS');
          this.sendCommand('GET_PLAYING_TITLE_NAME');

          this.emit('connected');
          settle(resolve);
        }, 500);
      });

      this.client.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.client.on('error', (err) => {
        this.connected = false;
        this.reportError(err);
        settle(reject, err);
      });

      this.client.on('close', () => {
        console.log('Kaleidescape connection closed');
        this.connected = false;
        this.emit('disconnected');
        // A socket that closes before connecting never produces a usable client
        settle(reject, new Error(`Connection to ${this.host}:${this.port} closed before it was ready`));
      });

      this.client.connect(this.port, this.host);
    });
  }

  /**
   * Report a socket error without killing the process.
   *
   * EventEmitter treats an 'error' event with no registered listener as an
   * uncaught exception, so emitting it unconditionally turned every unreachable
   * player into a crash. Emit only when someone is actually listening.
   */
  reportError(err) {
    console.error('Kaleidescape connection error:', err.message);
    if (this.listenerCount('error') > 0) {
      this.emit('error', err);
    }
  }

  sendCommand(commandName, params = '') {
    if (!this.connected) {
      console.warn('Not connected to Kaleidescape');
      return false;
    }

    const seq = this.seqNum;
    this.seqNum = (this.seqNum + 1) % 10;
    this.pendingCommands[seq] = commandName;

    const cmd = params
      ? `01/${seq}/${commandName}:${params}:`
      : `01/${seq}/${commandName}:`;

    if (this.debug) console.log('KS SEND:', cmd);
    this.client.write(cmd + '\r\n');
    return true;
  }

  // Called by monitor every poll interval to refresh state
  getPlayStatus() {
    this.sendCommand('GET_PLAY_STATUS');
    this.sendCommand('GET_PLAYING_TITLE_NAME');
  }

  processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        this.parseResponse(trimmed);
      }
    }
  }

  parseResponse(response) {
    // Response format: DEVICE/SEQ/STATUS:RESPONSE_NAME:FIELDS...:/CHECKSUM
    // Events use '!' for SEQ:   01/!/000:PLAY_STATUS:...:/CHECKSUM
    // Errors look like:         01/0/010:Invalid request:param:/CHECKSUM
    //                           ??/?/004:Invalid device:param:/CHECKSUM

    // Split on colon to get parts
    const parts = response.split(':');

    if (parts.length < 2) return;

    const header = parts[0]; // e.g. "01/0/000" or "??/?/019"
    const responseName = parts[1]; // e.g. "PLAY_STATUS" or "Invalid request"

    // Ignore if no device path
    if (!header.includes('/')) return;

    // Parse device/seq/status from header
    const headerParts = header.split('/');
    const statusCode = headerParts[2]; // 3-digit status or error source

    // Log everything except high-frequency noise
    const noisy = ['DEVICE_POWER_STATE', 'ASPECT_RATIO', 'SCREEN_MASK',
                   'CINEMASCAPE_MASK', 'VIDEO_MODE', 'VIDEO_COLOR', 'SCALE_MODE',
                   'SYSTEM_READINESS_STATE'];
    if (this.debug && !noisy.includes(responseName)) {
      console.log('KS MSG:', response);
    }

    // Non-000 status = error; log once and skip
    if (statusCode && statusCode !== '000' && statusCode !== '!' && !/^[0-9]$/.test(statusCode)) {
      // statusCode is like "010", "004", "019" — a real error
      const rejectedCommand = this.pendingCommands[headerParts[1]];

      // 020 is not a fault: the player is asleep. It answers this way to every
      // query until someone turns it on, so report the transition, not each poll.
      if (statusCode === STATUS_STANDBY) {
        this.currentState.playing = false;
        if (!this.standby) {
          this.standby = true;
          console.log(`Kaleidescape player at ${this.host} is in standby — waiting for it to wake`);
          this.emit('standby', true);
        }
        return;
      }

      // Dedup on what the message means, not the raw text: every response ends
      // in a different checksum, so comparing whole strings never matched and
      // the same condition logged on every single poll.
      const errorKey = `${statusCode}:${responseName}:${rejectedCommand || ''}`;
      if (this.lastErrorKey !== errorKey) {
        this.lastErrorKey = errorKey;
        console.log(`Kaleidescape error [${statusCode}] ${responseName}${rejectedCommand ? ` (in reply to ${rejectedCommand})` : ''}`);
      }

      // A movie server (Terra) accepts library queries but has no playback zone,
      // so it rejects these outright as an invalid request (010). Other statuses
      // - standby, busy - mean the command is supported but unavailable now.
      const playbackCommands = ['GET_PLAY_STATUS', 'GET_PLAYING_TITLE_NAME'];
      if (statusCode === STATUS_INVALID_REQUEST &&
          playbackCommands.includes(rejectedCommand) && !this.playbackUnsupported) {
        this.playbackUnsupported = true;
        console.warn(
          `\n⚠️  ${this.host} rejected ${rejectedCommand}` +
          `${this.deviceType ? ` — it reports itself as "${this.deviceType}"` : ''}.\n` +
          `    This device cannot report playback, so "Now Playing" will never appear.\n` +
          `    Set KALEIDESCAPE_PLAYER_HOST to your PLAYER, and KALEIDESCAPE_SERVER_HOST to\n` +
          `    this address (${this.host}) so the movie library still loads from it.\n` +
          `    On an all-in-one system such as a Strato V, leave KALEIDESCAPE_SERVER_HOST blank.\n`
        );
      }
      return;
    }

    // Dispatch on response name
    switch (responseName) {
      case 'PLAY_STATUS':
        this.handlePlayStatus(parts);
        break;
      case 'PLAYING_TITLE_NAME':
      case 'TITLE_NAME':
        this.handleTitleName(parts);
        break;
      case 'MOVIE_LOCATION':
        this.handleMovieLocation(parts);
        break;
      case 'HIGHLIGHTED_SELECTION':
        this.handleHighlightedSelection(parts);
        break;
      case 'CONTENT_DETAILS':
        this.handleContentDetails(parts);
        break;
      case 'DEVICE_INFO':
        console.log('Kaleidescape device info:', parts.slice(2).join(':'));
        break;
      case 'DEVICE_TYPE_NAME':
        this.deviceType = parts[2];
        console.log(`Kaleidescape device type: ${this.deviceType}`);
        break;
      // Silently ignore these
      case 'DEVICE_POWER_STATE':
      case 'SYSTEM_READINESS_STATE':
      case 'NUM_ZONES':
      case 'FRIENDLY_NAME':
      case 'SYSTEM_VERSION':
      case 'EVENTS_ENABLED':
        break;
      default:
        if (responseName && !responseName.startsWith('Invalid')) {
          if (this.debug) console.log(`Kaleidescape unhandled [${responseName}]:`, parts.slice(2).join(':'));
        }
    }
  }

  handlePlayStatus(parts) {
    // Confirmed format from live device test:
    // device/seq/status:PLAY_STATUS:play_status:play_speed:title_num:total_duration_secs:current_pos_secs:chapter_num:chapter_length:chapter_pos:/checksum
    // play_status: 0=none, 1=paused, 2=playing, 4=forward, 6=reverse

    // A successful PLAY_STATUS means the player answered, so it's awake
    if (this.standby) {
      this.standby = false;
      console.log(`Kaleidescape player at ${this.host} is awake`);
      this.emit('standby', false);
    }

    const playStatus = parts[2];
    const wasPlaying = this.currentState.playing;

    this.currentState.playStatus = playStatus;
    // Show poster for any active state (paused, playing, scanning)
    this.currentState.playing = playStatus !== '0' && playStatus !== '';

    // Duration and position confirmed from live test (Frozen 2: 6191s total, 1037s in)
    if (parts[5]) this.currentState.titleLength = parseInt(parts[5]) * 1000; // total duration in ms
    if (parts[6]) this.currentState.playTime = parseInt(parts[6]) * 1000;    // current position in ms

    if (this.debug) console.log(`Kaleidescape PLAY_STATUS: ${playStatus} (${this.currentState.playing ? 'active' : 'stopped'})`);

    if (wasPlaying !== this.currentState.playing) {
      this.emit('playbackStateChanged', this.currentState);
    }
  }

  handleTitleName(parts) {
    // Format: device/seq/status:TITLE_NAME:title_text:/checksum
    // Title is everything between index 2 and the final /checksum element
    const rawParts = parts.slice(2); // drop header and response name
    // Remove trailing checksum (starts with '/')
    const filtered = rawParts.filter((p, i) =>
      !(i === rawParts.length - 1 && p.startsWith('/'))
    );
    const title = filtered.join(':').trim();

    if (title && title !== this.currentState.contentTitle) {
      this.currentState.contentTitle = title;
      console.log(`Kaleidescape title: ${title}`);
      this.emit('nowPlayingChanged', this.currentState);
    }
  }

  handleMovieLocation(parts) {
    // Format: device/seq/status:MOVIE_LOCATION:location_code:/checksum
    // location codes: 0=none, 3=content, 4=intermission, 5=credits, 6=disc_menu
    const location = parts[2];
    if (this.debug) console.log(`Kaleidescape movie location: ${location}`);
  }

  handleHighlightedSelection(parts) {
    // Format: device/seq/status:HIGHLIGHTED_SELECTION:handle:type:title:...:/checksum
    const handle = parts[2];
    const title = parts[4];

    if (handle && handle.startsWith('/')) {
      if (this.isLoadingLibrary) {
        // Library loading handled elsewhere
      } else if (title) {
        this.currentState.contentHandle = handle;
        this.currentState.contentTitle = title;
        console.log(`Kaleidescape highlighted: ${title} (${handle})`);
      }
    }
  }

  handleContentDetails(parts) {
    // Format: device/seq/status:CONTENT_DETAILS:handle:type:title:cover_url:hires_cover_url:rating:year:...:/checksum
    if (parts.length > 5) {
      const handle = parts[2];
      const type = parts[3];
      const title = parts[4];
      const coverUrl = parts[5];
      const hiresCoverUrl = parts[6];
      const rating = parts[7];
      const year = parts[8];

      if (this.isLoadingLibrary && handle) {
        const movie = this.movieLibrary.find(m =>
          m.handle === handle ||
          m.handle === handle.substring(1) ||
          `/${m.handle}` === handle
        );
        if (movie && (hiresCoverUrl || coverUrl)) {
          movie.coverUrl = hiresCoverUrl || coverUrl;
        }
      } else {
        if (title) this.currentState.contentTitle = title;
        if (type) this.currentState.contentType = type;
        if (rating) this.currentState.rating = rating;
        if (year) this.currentState.year = year;
        if (coverUrl && coverUrl.startsWith('http')) {
          this.currentState.coverArt = hiresCoverUrl || coverUrl;
        }
        console.log(`Kaleidescape content: ${title} (${year}) ${rating}`);
        this.emit('contentUpdated', this.currentState);
      }
    }
  }

  getCurrentState() {
    return { ...this.currentState };
  }

  getLibrary() {
    return [...this.movieLibrary];
  }

  async loadMovieLibrary(serverHost) {
    if (!serverHost) serverHost = this.host;

    console.log('Loading Kaleidescape library from HTTP interface...');
    const axios = require('axios');

    try {
      const response = await axios.get(`http://${serverHost}/movies`, { timeout: 10000 });
      const html = response.data;

      const movieRegex = /<tr class="movie_container"[^>]*selection_handle="([^"]+)"[^>]*>[\s\S]*?<td class="movie_title"><a[^>]*>([^<]+)<\/a><\/td>[\s\S]*?<td class="movie_genre">([^<]*)<\/td>[\s\S]*?<td class="movie_rating">([^<]*)<\/td>[\s\S]*?<td class="movie_director[^>]*>([^<]*)<\/td>[\s\S]*?<td class="movie_year">([^<]*)<\/td>/g;

      let match;
      const movies = [];
      while ((match = movieRegex.exec(html)) !== null) {
        const [, handle, title, genre, rating, director, year] = match;
        movies.push({
          handle: handle.trim(),
          title: title.trim(),
          genre: genre.trim(),
          rating: rating.trim(),
          director: director.trim(),
          year: year.trim(),
          source: 'kaleidescape'
        });
      }

      console.log(`Parsed ${movies.length} movies from Kaleidescape HTTP interface`);
      this.movieLibrary = movies;
      return this.movieLibrary;

    } catch (error) {
      console.error('Error loading Kaleidescape library from HTTP:', error.message);
      throw error;
    }
  }

  disconnect() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.connected = false;
    }
  }
}

module.exports = KaleidescapeClient;
