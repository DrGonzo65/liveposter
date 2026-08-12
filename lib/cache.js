const fs = require('fs');
const path = require('path');

/**
 * Cache Manager for enriched movie metadata
 */
class CacheManager {
  constructor(cacheDir = '.cache') {
    this.cacheDir = cacheDir;
    this.cacheFile = path.join(cacheDir, 'movies.json');
    this.cache = {
      kaleidescape: [],
      plex: [],
      jellyfin: [],
      lastUpdated: null
    };

    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Load cache from disk
   */
  load() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf8');
        this.cache = JSON.parse(data);
        console.log(`📦 Loaded cache: ${this.getCacheStats()}`);
        return true;
      }
    } catch (error) {
      console.error('Error loading cache:', error.message);
    }
    return false;
  }

  /**
   * Save cache to disk
   */
  save() {
    try {
      this.cache.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
      console.log(`💾 Saved cache: ${this.getCacheStats()}`);
      return true;
    } catch (error) {
      console.error('Error saving cache:', error.message);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const kCount = this.cache.kaleidescape?.length || 0;
    const pCount = this.cache.plex?.length || 0;
    const jCount = this.cache.jellyfin?.length || 0;
    return `${kCount} Kaleidescape, ${pCount} Plex, ${jCount} Jellyfin`;
  }

  /**
   * Get cached movies for a source
   */
  get(source) {
    return this.cache[source] || [];
  }

  /**
   * Update cache for a source
   */
  set(source, movies) {
    this.cache[source] = movies;
  }

  /**
   * Find movies that need enrichment (new or missing metadata)
   */
  findMoviesToEnrich(source, currentMovies) {
    const cached = this.get(source);
    const moviesToEnrich = [];

    for (const movie of currentMovies) {
      // Create a unique key based on title and year
      const key = this.getMovieKey(movie);

      // Check if movie is in cache with full metadata
      const cachedMovie = cached.find(m => this.getMovieKey(m) === key);

      if (!cachedMovie || !this.hasFullMetadata(cachedMovie)) {
        moviesToEnrich.push(movie);
      }
    }

    return moviesToEnrich;
  }

  /**
   * Merge enriched movies with cached movies
   */
  mergeMovies(source, currentMovies, enrichedMovies) {
    const cached = this.get(source);
    const merged = [];

    for (const movie of currentMovies) {
      const key = this.getMovieKey(movie);

      // Check if this movie was just enriched
      const enriched = enrichedMovies.find(m => this.getMovieKey(m) === key);
      if (enriched) {
        merged.push(enriched);
        continue;
      }

      // Otherwise, use cached version if available
      const cachedMovie = cached.find(m => this.getMovieKey(m) === key);
      if (cachedMovie && this.hasFullMetadata(cachedMovie)) {
        merged.push(cachedMovie);
      } else {
        merged.push(movie);
      }
    }

    return merged;
  }

  /**
   * Create a unique key for a movie
   */
  getMovieKey(movie) {
    const title = (movie.title || '').toLowerCase().trim();
    const year = movie.year || 'unknown';
    return `${title}|${year}`;
  }

  /**
   * Check if a movie has full TMDb metadata
   */
  hasFullMetadata(movie) {
    return !!(movie.tmdbId && movie.posterUrl);
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache = {
      kaleidescape: [],
      plex: [],
      jellyfin: [],
      lastUpdated: null
    };

    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
      console.log('🗑️  Cache cleared');
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error.message);
      return false;
    }
  }
}

module.exports = CacheManager;
