const EventEmitter = require('events');
const KaleidescapeClient = require('./kaleidescape');
const PlexClient = require('./plex');
const JellyfinClient = require('./jellyfin');
const TMDBClient = require('./tmdb');
const OMDbClient = require('./omdb');
const CacheManager = require('./cache');

/**
 * Media Monitoring Service
 * Polls all media systems and manages current playback state
 */
class MediaMonitor extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.currentState = {
      playing: false,
      source: null,
      content: null,
      lastChecked: null
    };

    this.kaleidescapeLibrary = [];
    this.plexLibrary = [];
    this.jellyfinLibrary = [];
    this.allLibraries = [];

    this.pollInterval = null;
    this.isPolling = false;

    // Initialize cache manager
    this.cache = new CacheManager();

    // Initialize clients
    this.initializeClients();
  }

  initializeClients() {
    // Kaleidescape
    if (this.config.kaleidescape?.host) {
      this.kaleidescapeClient = new KaleidescapeClient(
        this.config.kaleidescape.host,
        this.config.kaleidescape.port
      );
    }

    // Plex
    if (this.config.plex?.url && this.config.plex?.token) {
      this.plexClient = new PlexClient(
        this.config.plex.url,
        this.config.plex.token
      );
    }

    // Jellyfin
    if (this.config.jellyfin?.url && this.config.jellyfin?.apiKey) {
      this.jellyfinClient = new JellyfinClient(
        this.config.jellyfin.url,
        this.config.jellyfin.apiKey
      );
    }

    // OMDb (for Rotten Tomatoes scores)
    if (this.config.omdb?.apiKey) {
      this.omdbClient = new OMDbClient(this.config.omdb.apiKey);
    }

    // TheMovieDB
    if (this.config.tmdb?.apiKey && this.config.tmdb?.readToken) {
      this.tmdbClient = new TMDBClient(
        this.config.tmdb.apiKey,
        this.config.tmdb.readToken,
        this.omdbClient // Pass OMDb client for RT scores
      );
    }
  }

  async start() {
    console.log('Starting media monitor...');
    console.log('');

    // Initialize TheMovieDB
    if (this.tmdbClient) {
      console.log('Initializing TheMovieDB client...');
      const tmdbInitialized = await this.tmdbClient.initialize();
      console.log(`${tmdbInitialized ? '✓' : '✗'} TheMovieDB ${tmdbInitialized ? 'initialized' : 'initialization failed'}`);
      console.log('');
    }

    // Connect to Kaleidescape
    if (this.kaleidescapeClient) {
      try {
        console.log(`Connecting to Kaleidescape at ${this.config.kaleidescape.host}:${this.config.kaleidescape.port}...`);
        await this.kaleidescapeClient.connect();
        console.log('✓ Kaleidescape connected');
      } catch (error) {
        console.error('✗ Kaleidescape connection failed:', error.message);
      }
    } else {
      console.log('⊘ Kaleidescape not configured');
    }

    // Test other connections
    if (this.plexClient) {
      console.log(`Testing Plex connection at ${this.config.plex.url}...`);
      const plexConnected = await this.plexClient.testConnection();
      console.log(`${plexConnected ? '✓' : '✗'} Plex ${plexConnected ? 'connected' : 'connection failed'}`);
    } else {
      console.log('⊘ Plex not configured');
    }

    if (this.jellyfinClient) {
      console.log(`Testing Jellyfin connection at ${this.config.jellyfin.url}...`);
      const jellyfinConnected = await this.jellyfinClient.testConnection();
      console.log(`${jellyfinConnected ? '✓' : '✗'} Jellyfin ${jellyfinConnected ? 'connected' : 'connection failed'}`);
    } else {
      console.log('⊘ Jellyfin not configured');
    }

    console.log('');

    // Load libraries
    await this.loadLibraries();

    // Start polling
    this.startPolling();
  }

  async loadLibraries() {
    console.log('Loading media libraries...');

    // Load cache
    this.cache.load();

    // Load Kaleidescape library from HTTP interface
    if (this.kaleidescapeClient && this.kaleidescapeClient.connected) {
      try {
        // Use the HTTP interface on the Kaleidescape host
        const httpHost = this.config.kaleidescape.httpHost || this.config.kaleidescape.host;
        await this.kaleidescapeClient.loadMovieLibrary(httpHost);
        this.kaleidescapeLibrary = this.kaleidescapeClient.getLibrary();
        console.log(`Loaded ${this.kaleidescapeLibrary.length} movies from Kaleidescape`);

        // Enrich with TheMovieDB metadata (only new movies)
        if (this.tmdbClient && this.kaleidescapeLibrary.length > 0) {
          const moviesToEnrich = this.cache.findMoviesToEnrich('kaleidescape', this.kaleidescapeLibrary);

          if (moviesToEnrich.length > 0) {
            console.log(`\n🔍 Enriching ${moviesToEnrich.length} new/updated Kaleidescape movies with TMDb metadata...`);
            const enrichedMovies = await this.tmdbClient.enrichMovies(moviesToEnrich);
            this.kaleidescapeLibrary = this.cache.mergeMovies('kaleidescape', this.kaleidescapeLibrary, enrichedMovies);
            this.cache.set('kaleidescape', this.kaleidescapeLibrary);
            this.cache.save();
            console.log('');
          } else {
            console.log(`✨ Using cached metadata for ${this.kaleidescapeLibrary.length} Kaleidescape movies`);
            this.kaleidescapeLibrary = this.cache.mergeMovies('kaleidescape', this.kaleidescapeLibrary, []);
          }
        }
      } catch (error) {
        console.error('Error loading Kaleidescape library:', error.message);
        this.kaleidescapeLibrary = [];
      }
    }

    // Load Plex library
    if (this.plexClient) {
      try {
        this.plexLibrary = await this.plexClient.getMovieLibrary();
        console.log(`Loaded ${this.plexLibrary.length} movies from Plex`);

        // Enrich with TheMovieDB metadata (only new movies)
        if (this.tmdbClient && this.plexLibrary.length > 0) {
          const moviesToEnrich = this.cache.findMoviesToEnrich('plex', this.plexLibrary);

          if (moviesToEnrich.length > 0) {
            console.log(`\n🔍 Enriching ${moviesToEnrich.length} new/updated Plex movies with TMDb metadata...`);
            const enrichedMovies = await this.tmdbClient.enrichMovies(moviesToEnrich);
            this.plexLibrary = this.cache.mergeMovies('plex', this.plexLibrary, enrichedMovies);
            this.cache.set('plex', this.plexLibrary);
            this.cache.save();
            console.log('');
          } else {
            console.log(`✨ Using cached metadata for ${this.plexLibrary.length} Plex movies`);
            this.plexLibrary = this.cache.mergeMovies('plex', this.plexLibrary, []);
          }
        }
      } catch (error) {
        console.error('Error loading Plex library:', error.message);
      }
    }

    // Load Jellyfin library
    if (this.jellyfinClient) {
      try {
        this.jellyfinLibrary = await this.jellyfinClient.getMovieLibrary();
        console.log(`Loaded ${this.jellyfinLibrary.length} movies from Jellyfin`);

        // Enrich with TheMovieDB metadata (only new movies)
        if (this.tmdbClient && this.jellyfinLibrary.length > 0) {
          const moviesToEnrich = this.cache.findMoviesToEnrich('jellyfin', this.jellyfinLibrary);

          if (moviesToEnrich.length > 0) {
            console.log(`\n🔍 Enriching ${moviesToEnrich.length} new/updated Jellyfin movies with TMDb metadata...`);
            const enrichedMovies = await this.tmdbClient.enrichMovies(moviesToEnrich);
            this.jellyfinLibrary = this.cache.mergeMovies('jellyfin', this.jellyfinLibrary, enrichedMovies);
            this.cache.set('jellyfin', this.jellyfinLibrary);
            this.cache.save();
            console.log('');
          } else {
            console.log(`✨ Using cached metadata for ${this.jellyfinLibrary.length} Jellyfin movies`);
            this.jellyfinLibrary = this.cache.mergeMovies('jellyfin', this.jellyfinLibrary, []);
          }
        }
      } catch (error) {
        console.error('Error loading Jellyfin library:', error.message);
      }
    }

    // Combine all libraries
    this.allLibraries = [
      ...this.kaleidescapeLibrary,
      ...this.plexLibrary,
      ...this.jellyfinLibrary
    ];

    console.log(`Total movies in combined library: ${this.allLibraries.length}`);
  }

  startPolling() {
    const interval = this.config.pollInterval || 10000; // Default 10 seconds
    console.log(`Starting polling every ${interval}ms`);

    this.pollInterval = setInterval(() => {
      this.checkAllSystems();
    }, interval);

    // Do initial check immediately
    this.checkAllSystems();
  }

  async checkAllSystems() {
    if (this.isPolling) return; // Prevent overlapping polls

    this.isPolling = true;

    try {
      // Priority order: Kaleidescape > Plex > Jellyfin
      let nowPlaying = null;

      // Check Kaleidescape
      if (this.kaleidescapeClient) {
        if (!this.kaleidescapeClient.connected) {
          console.log('Kaleidescape not connected, attempting to reconnect...');
          try {
            await this.kaleidescapeClient.connect();
          } catch (error) {
            console.error('Failed to reconnect to Kaleidescape:', error.message);
          }
        }

        if (this.kaleidescapeClient.connected) {
          // Load library on-demand if it's empty (happens when connection wasn't ready at startup)
          if (this.kaleidescapeLibrary.length === 0 && !this.kaleidescapeLibraryLoading) {
            this.kaleidescapeLibraryLoading = true;
            console.log('Kaleidescape library empty, loading now...');
            this.kaleidescapeClient.loadMovieLibrary(this.config.kaleidescape.httpHost || this.config.kaleidescape.host)
              .then(async () => {
                this.kaleidescapeLibrary = this.kaleidescapeClient.getLibrary();
                console.log(`Loaded ${this.kaleidescapeLibrary.length} Kaleidescape movies on-demand`);
                if (this.tmdbClient && this.kaleidescapeLibrary.length > 0) {
                  const toEnrich = this.cache.findMoviesToEnrich('kaleidescape', this.kaleidescapeLibrary);
                  if (toEnrich.length > 0) {
                    const enriched = await this.tmdbClient.enrichMovies(toEnrich);
                    this.kaleidescapeLibrary = this.cache.mergeMovies('kaleidescape', this.kaleidescapeLibrary, enriched);
                    this.cache.set('kaleidescape', this.kaleidescapeLibrary);
                    this.cache.save();
                  } else {
                    this.kaleidescapeLibrary = this.cache.mergeMovies('kaleidescape', this.kaleidescapeLibrary, []);
                  }
                }
                this.kaleidescapeLibraryLoading = false;
              })
              .catch(err => {
                console.error('On-demand Kaleidescape library load failed:', err.message);
                this.kaleidescapeLibraryLoading = false;
              });
          }

          this.kaleidescapeClient.getPlayStatus();
          const kState = this.kaleidescapeClient.getCurrentState();

          console.log(`Kaleidescape state: playing=${kState.playing}, title=${kState.contentTitle}`);

          if (kState.playing) {
            nowPlaying = {
              source: 'kaleidescape',
              playing: true,
              title: kState.contentTitle || 'Now Playing',
              type: kState.contentType || 'movie',
              thumb: kState.coverArt,
              coverUrl: kState.coverArt,
              playerState: kState.playStatus === '2' ? 'playing' : 'paused',
              duration: kState.titleLength || null,
              viewOffset: kState.playTime || null
            };
            console.log('Kaleidescape now playing detected:', nowPlaying.title);
          }
        }
      }

      // Check Plex if nothing playing on Kaleidescape
      if (!nowPlaying && this.plexClient) {
        const plexPlaying = await this.plexClient.getNowPlaying();
        if (plexPlaying) {
          nowPlaying = plexPlaying;
        }
      }

      // Check Jellyfin if nothing playing on Plex or Kaleidescape
      if (!nowPlaying && this.jellyfinClient) {
        const jellyfinPlaying = await this.jellyfinClient.getNowPlaying();
        if (jellyfinPlaying) {
          nowPlaying = jellyfinPlaying;
        }
      }

      // Update state
      const previouslyPlaying = this.currentState.playing;

      if (nowPlaying) {
        // Enrich with full library metadata if available
        const enrichedContent = this.enrichPlayingContent(nowPlaying);

        this.currentState = {
          playing: true,
          source: nowPlaying.source,
          content: enrichedContent,
          lastChecked: new Date()
        };

        if (!previouslyPlaying) {
          this.emit('playbackStarted', this.currentState);
        } else {
          this.emit('stateChanged', this.currentState);
        }
      } else {
        this.currentState = {
          playing: false,
          source: null,
          content: null,
          lastChecked: new Date()
        };

        if (previouslyPlaying) {
          this.emit('playbackStopped', this.currentState);
        }
      }
    } catch (error) {
      console.error('Error checking systems:', error.message);
    } finally {
      this.isPolling = false;
    }
  }

  enrichPlayingContent(nowPlaying) {
    // Try to match the playing content to library metadata
    let library = [];

    switch (nowPlaying.source) {
      case 'kaleidescape':
        library = this.kaleidescapeLibrary;
        break;
      case 'plex':
        library = this.plexLibrary;
        break;
      case 'jellyfin':
        library = this.jellyfinLibrary;
        break;
    }

    if (library.length === 0) {
      console.log(`enrichPlayingContent: ${nowPlaying.source} library is empty`);
      return nowPlaying;
    }

    const normalize = (s) => (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // strip punctuation
      .replace(/\s+/g, ' ')
      .trim();

    const title = normalize(nowPlaying.title);

    // Exact normalized match first
    let match = library.find(m => normalize(m.title) === title);

    // Fallback: one contains the other (handles "Frozen 2" vs "Frozen II" less likely, but catches prefixes)
    if (!match) {
      match = library.find(m => {
        const mt = normalize(m.title);
        return mt.startsWith(title) || title.startsWith(mt);
      });
    }

    if (!match) {
      console.log(`enrichPlayingContent: no match for "${nowPlaying.title}" in ${nowPlaying.source} library (${library.length} titles)`);
    }

    if (match) {
      // Merge playback info with full library metadata
      return {
        ...match,
        playing: true,
        playerState: nowPlaying.playerState,
        duration: nowPlaying.duration,
        viewOffset: nowPlaying.viewOffset
      };
    }

    // No match found, return original
    return nowPlaying;
  }

  getCurrentState() {
    return { ...this.currentState };
  }

  getLibrary(source = 'all', slideshowOnly = false) {
    let library = [];
    switch (source) {
      case 'kaleidescape':
        library = [...this.kaleidescapeLibrary];
        break;
      case 'plex':
        library = [...this.plexLibrary];
        break;
      case 'jellyfin':
        library = [...this.jellyfinLibrary];
        break;
      default:
        library = [...this.allLibraries];
    }

    // Filter for slideshow if requested (only show movies not explicitly disabled)
    if (slideshowOnly) {
      library = library.filter(movie => movie.slideshowEnabled !== false);
    }

    return library;
  }

  getRandomMovie(source = 'kaleidescape') {
    let library = this.getLibrary(source, true); // Only slideshow-enabled movies

    // Filter by allowed MPAA ratings
    if (this.config.allowedRatings && this.config.allowedRatings.length > 0) {
      library = library.filter(movie => {
        // Get the rating from various possible fields
        const rating = movie.rating || movie.officialRating || movie.contentRating;

        if (!rating) {
          // If no rating, treat as NR (Not Rated)
          return this.config.allowedRatings.includes('NR');
        }

        // Normalize rating for comparison
        const normalizedRating = String(rating).trim().toUpperCase();

        // Check if this rating is in the allowed list
        return this.config.allowedRatings.some(allowed => {
          if (allowed === 'NR' && (normalizedRating === 'NOT RATED' || normalizedRating === 'UNRATED' || normalizedRating === 'NR')) {
            return true;
          }
          return normalizedRating === allowed.toUpperCase();
        });
      });
    }

    if (library.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * library.length);
    return library[randomIndex];
  }

  async searchMovieAlternatives(title, year) {
    if (!this.tmdbClient) {
      throw new Error('TMDb client not initialized');
    }

    // Search TMDb for multiple alternative matches (movies and TV)
    const searchResults = await this.tmdbClient.searchMovieMultiple(title, year);

    if (!searchResults || searchResults.length === 0) {
      return [];
    }

    // Get full details for each result
    const enrichedResults = [];

    for (const result of searchResults) {
      try {
        const isTV = result.media_type === 'tv';

        // Get full details including tagline
        let details;
        if (isTV) {
          details = await this.tmdbClient.getTVDetails(result.id);
        } else {
          details = await this.tmdbClient.getMovieDetails(result.id);
        }

        // Fetch RT score
        let rottenTomatoes = null;
        if (this.omdbClient && details?.imdb_id) {
          try {
            const omdbData = await this.omdbClient.getMovieByImdbId(details.imdb_id);
            rottenTomatoes = omdbData?.rottenTomatoes || null;
          } catch (error) {
            // Ignore RT fetch errors, continue with other data
          }
        }

        enrichedResults.push({
          tmdbId: result.id,
          title: result.title,
          year: result.release_date ? result.release_date.substring(0, 4) : null,
          overview: result.overview || details?.overview,
          tagline: details?.tagline || null,
          posterUrl: this.tmdbClient.getPosterUrl(result.poster_path),
          posterUrlLarge: this.tmdbClient.getPosterUrl(result.poster_path, 'w780'),
          backdropUrl: result.backdrop_path ?
            `${this.tmdbClient.imageBaseUrl}w1280${result.backdrop_path}` : null,
          voteAverage: result.vote_average,
          rottenTomatoes: rottenTomatoes,
          imdbId: details?.imdb_id,
          mediaType: isTV ? 'tv' : 'movie'
        });
      } catch (error) {
        console.error(`Error enriching search result for ${result.title}:`, error.message);
        // Add basic result even if enrichment fails
        enrichedResults.push({
          tmdbId: result.id,
          title: result.title,
          year: result.release_date ? result.release_date.substring(0, 4) : null,
          overview: result.overview,
          tagline: null,
          posterUrl: this.tmdbClient.getPosterUrl(result.poster_path),
          posterUrlLarge: this.tmdbClient.getPosterUrl(result.poster_path, 'w780'),
          backdropUrl: result.backdrop_path ?
            `${this.tmdbClient.imageBaseUrl}w1280${result.backdrop_path}` : null,
          voteAverage: result.vote_average,
          rottenTomatoes: null,
          imdbId: null,
          mediaType: result.media_type || 'movie'
        });
      }
    }

    return enrichedResults;
  }

  async updateMovieMetadata(source, originalTitle, tmdbId, mediaType = 'movie') {
    if (!this.tmdbClient) {
      throw new Error('TMDb client not initialized');
    }

    // Get the library for the source
    let library = [];
    switch (source) {
      case 'kaleidescape':
        library = this.kaleidescapeLibrary;
        break;
      case 'plex':
        library = this.plexLibrary;
        break;
      case 'jellyfin':
        library = this.jellyfinLibrary;
        break;
      default:
        throw new Error('Invalid source');
    }

    // Find the movie by original title
    const movieIndex = library.findIndex(m =>
      m.title.toLowerCase().trim() === originalTitle.toLowerCase().trim()
    );

    if (movieIndex === -1) {
      throw new Error('Movie not found in library');
    }

    const movie = library[movieIndex];

    // Fetch new metadata from TMDb (either movie or TV series)
    const isTV = mediaType === 'tv';
    const movieDetails = isTV ?
      await this.tmdbClient.getTVDetails(tmdbId) :
      await this.tmdbClient.getMovieDetails(tmdbId);

    if (!movieDetails) {
      throw new Error('Could not fetch movie details from TMDb');
    }

    // Fetch RT score
    let rottenTomatoes = null;
    if (this.omdbClient && movieDetails.imdb_id) {
      const omdbData = await this.omdbClient.getMovieByImdbId(movieDetails.imdb_id);
      rottenTomatoes = omdbData?.rottenTomatoes || null;
    }

    // Update the movie with new metadata
    const updatedMovie = {
      ...movie,
      tmdbId: movieDetails.id,
      mediaType: mediaType,
      overview: movieDetails.overview,
      tagline: movieDetails.tagline || null,
      imdbId: movieDetails.imdb_id || null,
      rottenTomatoes: rottenTomatoes,
      posterPath: movieDetails.poster_path,
      posterUrl: this.tmdbClient.getPosterUrl(movieDetails.poster_path),
      posterUrlLarge: this.tmdbClient.getPosterUrl(movieDetails.poster_path, 'w780'),
      backdropPath: movieDetails.backdrop_path,
      backdropUrl: movieDetails.backdrop_path ?
        `${this.tmdbClient.imageBaseUrl}w1280${movieDetails.backdrop_path}` : null,
      voteAverage: movieDetails.vote_average,
      releaseDate: movieDetails.release_date,
      popularity: movieDetails.popularity
    };

    // Update in library
    library[movieIndex] = updatedMovie;

    // Update cache
    this.cache.set(source, library);
    this.cache.save();

    // Update combined library
    this.allLibraries = [
      ...this.kaleidescapeLibrary,
      ...this.plexLibrary,
      ...this.jellyfinLibrary
    ];

    return {
      success: true,
      movie: updatedMovie
    };
  }

  async toggleMovieSlideshow(source, title, enabled) {
    // Get the library for the source
    let library = [];
    switch (source) {
      case 'kaleidescape':
        library = this.kaleidescapeLibrary;
        break;
      case 'plex':
        library = this.plexLibrary;
        break;
      case 'jellyfin':
        library = this.jellyfinLibrary;
        break;
      default:
        throw new Error('Invalid source');
    }

    // Find the movie by title
    const movieIndex = library.findIndex(m =>
      m.title.toLowerCase().trim() === title.toLowerCase().trim()
    );

    if (movieIndex === -1) {
      throw new Error('Movie not found in library');
    }

    // Update the slideshowEnabled flag
    library[movieIndex].slideshowEnabled = enabled;

    // Update cache
    this.cache.set(source, library);
    this.cache.save();

    // Update combined library
    this.allLibraries = [
      ...this.kaleidescapeLibrary,
      ...this.plexLibrary,
      ...this.jellyfinLibrary
    ];

    return {
      success: true,
      movie: library[movieIndex]
    };
  }

  stop() {
    console.log('Stopping media monitor...');

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.kaleidescapeClient) {
      this.kaleidescapeClient.disconnect();
    }

    this.isPolling = false;
  }
}

module.exports = MediaMonitor;
