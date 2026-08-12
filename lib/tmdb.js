const axios = require('axios');
const he = require('he'); // HTML entity decoder

/**
 * TheMovieDB API Client
 * Fetches movie metadata and poster images
 */
class TMDBClient {
  constructor(apiKey, readToken, omdbClient = null) {
    this.apiKey = apiKey;
    this.readToken = readToken;
    this.omdbClient = omdbClient;
    this.baseUrl = 'https://api.themoviedb.org/3';
    this.imageBaseUrl = null;
    this.posterSizes = null;

    // Configure axios defaults
    this.axiosConfig = {
      headers: {
        'Authorization': `Bearer ${this.readToken}`
      },
      timeout: 10000 // 10 second timeout
    };
  }

  /**
   * Make an axios GET request with timeout and authorization
   */
  async get(url, params = {}) {
    return axios.get(url, {
      ...this.axiosConfig,
      params
    });
  }

  /**
   * Clean and normalize a movie title for searching
   */
  cleanTitle(title) {
    // Decode HTML entities (&apos;, &amp;, &mdash;, &nbsp;, etc.)
    let cleaned = he.decode(title);

    // Normalize special characters FIRST (before pattern matching)
    cleaned = cleaned.replace(/[''`]/g, "'"); // Normalize all apostrophe variants
    cleaned = cleaned.replace(/[—–]/g, '-'); // Normalize dashes

    // Fix common character encoding issues
    cleaned = cleaned.replace(/L�on/g, 'Leon');
    cleaned = cleaned.replace(/�/g, 'e'); // Common encoding for é

    // Remove edition text in parentheses (now that apostrophes are normalized)
    cleaned = cleaned.replace(/\s*\((Director's Cut|Extended Cut|Unrated|Special Edition|Theatrical Cut|Collector's Edition)\)\s*/gi, '');

    // Remove season/episode information but keep base series name
    cleaned = cleaned.replace(/\s*\((Season[s]?\s+[\d\s&,]+|Complete Series)\)\s*/gi, '');

    // Remove (2024) style year duplicates at the end
    cleaned = cleaned.replace(/\s*\(\d{4}\)\s*\(\d{4}\)/, '');

    // Remove year in parentheses at the end
    cleaned = cleaned.replace(/\s*\(\d{4}\)\s*$/, '');

    // Remove empty parentheses
    cleaned = cleaned.replace(/\s*\(\s*\)\s*/g, '');

    return cleaned.trim();
  }

  /**
   * Check if a title is likely a TV series
   */
  isTVSeries(title) {
    const tvPatterns = [
      /\(Season[s]?\s+[\d\s&,]+\)/i,
      /\(Complete Series\)/i,
      /Season\s+\d+/i,
      /\d{4}\)\s*\(Season/i // Pattern like "(2019) (Season 1)"
    ];
    return tvPatterns.some(pattern => pattern.test(title));
  }

  /**
   * Extract season number from title
   */
  extractSeasonNumber(title) {
    const match = title.match(/Season\s+(\d+)/i);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Initialize the client by fetching image configuration
   */
  async initialize() {
    try {
      const response = await this.get(`${this.baseUrl}/configuration`);

      this.imageBaseUrl = response.data.images.secure_base_url;
      this.posterSizes = response.data.images.poster_sizes;

      console.log('TMDb client initialized');
      console.log(`Image base URL: ${this.imageBaseUrl}`);

      return true;
    } catch (error) {
      console.error('Error initializing TMDb client:', error.message);
      return false;
    }
  }

  /**
   * Search for a TV series by title and year
   */
  async searchTVSeries(title, year) {
    try {
      // Clean the title for TV series too
      const cleanedTitle = this.cleanTitle(title);

      const params = {
        query: cleanedTitle,
        include_adult: false
      };

      if (year) {
        params.first_air_date_year = year;
      }

      let response = await axios.get(`${this.baseUrl}/search/tv`, {
        headers: {
          'Authorization': `Bearer ${this.readToken}`
        },
        params
      });

      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0];
      }

      // Try without year if no results
      if (year && response.data.results.length === 0) {
        params.first_air_date_year = undefined;
        response = await axios.get(`${this.baseUrl}/search/tv`, {
          headers: {
            'Authorization': `Bearer ${this.readToken}`
          },
          params
        });

        if (response.data.results && response.data.results.length > 0) {
          return response.data.results[0];
        }
      }

      return null;
    } catch (error) {
      console.error(`Error searching for TV series "${title}":`, error.message);
      return null;
    }
  }

  /**
   * Search for a movie by title and year with improved matching
   */
  async searchMovie(title, year) {
    try {
      // Clean the title
      const cleanedTitle = this.cleanTitle(title);

      // Check for alternate titles first (these are usually more accurate)
      const alternateTitles = this.getAlternateTitle(cleanedTitle);
      if (alternateTitles) {
        for (const altTitle of alternateTitles) {
          let params = {
            query: altTitle,
            include_adult: false
          };

          if (year) {
            params.year = year;
          }

          let response = await axios.get(`${this.baseUrl}/search/movie`, {
            headers: {
              'Authorization': `Bearer ${this.readToken}`
            },
            params
          });

          if (response.data.results && response.data.results.length > 0) {
            // If we have a year, find the best match by year
            if (year) {
              const matchByYear = response.data.results.find(r => {
                const releaseYear = r.release_date ? r.release_date.substring(0, 4) : null;
                return releaseYear === year.toString();
              });
              if (matchByYear) {
                return matchByYear;
              }
            }
            return response.data.results[0];
          }
        }
      }

      // First attempt: cleaned title with year
      let params = {
        query: cleanedTitle,
        include_adult: false
      };

      if (year) {
        params.year = year;
      }

      let response = await this.get(`${this.baseUrl}/search/movie`, params);

      if (response.data.results && response.data.results.length > 0) {
        // If we have a year, find the best match by year (prefer ±1 year over exact but worse title match)
        if (year) {
          const yearNum = parseInt(year);

          // First check for matches within ±1 year
          const closeYearMatches = response.data.results.filter(r => {
            if (!r.release_date) return false;
            const releaseYear = parseInt(r.release_date.substring(0, 4));
            return Math.abs(releaseYear - yearNum) <= 1;
          });

          if (closeYearMatches.length > 0) {
            // Prefer the first result if it's in the close year matches (TMDb ranks by relevance)
            if (closeYearMatches.includes(response.data.results[0])) {
              return response.data.results[0];
            }
            // Otherwise return the first close match
            return closeYearMatches[0];
          }
        }
        // Otherwise return first result (TMDb's best match)
        return response.data.results[0];
      }

      // Second attempt: without year filter (in case year is wrong)
      if (year) {
        params = {
          query: cleanedTitle,
          include_adult: false
        };

        response = await this.get(`${this.baseUrl}/search/movie`, params);

        if (response.data.results && response.data.results.length > 0) {
          // Try to find match within ±1 year
          const yearNum = parseInt(year);
          const closeMatch = response.data.results.find(r => {
            if (!r.release_date) return false;
            const releaseYear = parseInt(r.release_date.substring(0, 4));
            return Math.abs(releaseYear - yearNum) <= 1;
          });
          if (closeMatch) {
            return closeMatch;
          }
          return response.data.results[0];
        }
      }

      return null;
    } catch (error) {
      console.error(`Error searching for movie "${title}":`, error.message);
      return null;
    }
  }

  /**
   * Search for multiple movie AND TV series matches (for manual correction)
   */
  async searchMovieMultiple(title, year) {
    try {
      const cleanedTitle = this.cleanTitle(title);
      const allResults = [];

      // Search movies
      let movieParams = {
        query: cleanedTitle,
        include_adult: false
      };

      if (year) {
        movieParams.year = year;
      }

      const movieResponse = await axios.get(`${this.baseUrl}/search/movie`, {
        headers: {
          'Authorization': `Bearer ${this.readToken}`
        },
        params: movieParams
      });

      if (movieResponse.data.results && movieResponse.data.results.length > 0) {
        // Mark as movies and add to results
        const movies = movieResponse.data.results.slice(0, 15).map(m => ({
          ...m,
          media_type: 'movie'
        }));
        allResults.push(...movies);
      }

      // Search TV series
      let tvParams = {
        query: cleanedTitle,
        include_adult: false
      };

      if (year) {
        tvParams.first_air_date_year = year;
      }

      const tvResponse = await axios.get(`${this.baseUrl}/search/tv`, {
        headers: {
          'Authorization': `Bearer ${this.readToken}`
        },
        params: tvParams
      });

      if (tvResponse.data.results && tvResponse.data.results.length > 0) {
        // Mark as TV and add to results
        const tvShows = tvResponse.data.results.slice(0, 10).map(tv => ({
          ...tv,
          media_type: 'tv',
          title: tv.name, // TV shows use 'name' instead of 'title'
          release_date: tv.first_air_date // TV shows use 'first_air_date'
        }));
        allResults.push(...tvShows);
      }

      // Return up to 20 combined results
      return allResults.slice(0, 20);
    } catch (error) {
      console.error(`Error searching for content with title "${title}":`, error.message);
      return [];
    }
  }

  /**
   * Get alternate titles for known problematic movies
   */
  getAlternateTitle(title) {
    const alternates = {
      "Harry Potter and the Sorcerer's Stone": ["Harry Potter and the Philosopher's Stone"],
      "Léon, the Professional": ["Léon", "The Professional", "Leon: The Professional"],
      "Leon, the Professional": ["Léon", "The Professional", "Leon: The Professional"],
      "L�on, the Professional": ["Léon", "The Professional", "Leon: The Professional", "Leon"],
      "Wall-E": ["WALL·E"], // Official TMDb title uses middle dot
      "It's Always Sunny in Philadelphia": ["Its Always Sunny in Philadelphia"]
    };

    return alternates[title] || null;
  }

  /**
   * Get TV series details
   */
  async getTVDetails(tvId) {
    try {
      const response = await axios.get(`${this.baseUrl}/tv/${tvId}`, {
        headers: {
          'Authorization': `Bearer ${this.readToken}`
        }
      });

      // Also fetch external IDs (for IMDb)
      let externalIds = null;
      try {
        const externalIdsResponse = await axios.get(`${this.baseUrl}/tv/${tvId}/external_ids`, {
          headers: {
            'Authorization': `Bearer ${this.readToken}`
          }
        });
        externalIds = externalIdsResponse.data;
      } catch (error) {
        console.error(`Error fetching external IDs for TV ${tvId}:`, error.message);
      }

      return {
        ...response.data,
        imdb_id: externalIds?.imdb_id || response.data.imdb_id
      };
    } catch (error) {
      console.error(`Error fetching TV details for ID ${tvId}:`, error.message);
      return null;
    }
  }

  /**
   * Get full movie details including tagline and external IDs
   */
  async getMovieDetails(movieId) {
    try {
      const response = await this.get(`${this.baseUrl}/movie/${movieId}`);

      // Also fetch external IDs (for IMDb)
      let externalIds = null;
      try {
        const externalIdsResponse = await this.get(`${this.baseUrl}/movie/${movieId}/external_ids`);
        externalIds = externalIdsResponse.data;
      } catch (error) {
        console.error(`Error fetching external IDs for movie ${movieId}:`, error.message);
      }

      return {
        ...response.data,
        imdb_id: externalIds?.imdb_id || response.data.imdb_id
      };
    } catch (error) {
      console.error(`Error fetching movie details for ID ${movieId}:`, error.message);
      return null;
    }
  }

  /**
   * Get full poster URL from poster path
   * @param {string} posterPath - The poster_path from TMDb API
   * @param {string} size - Desired size (w92, w154, w185, w342, w500, w780, original)
   */
  getPosterUrl(posterPath, size = 'w780') {
    if (!posterPath || !this.imageBaseUrl) {
      return null;
    }

    return `${this.imageBaseUrl}${size}${posterPath}`;
  }

  /**
   * Enrich a movie object with TMDb metadata
   */
  async enrichMovie(movie) {
    // Decode HTML entities first before checking if it's a TV series
    const decodedTitle = he.decode(movie.title);

    // Check if this is a TV series (use decoded title for pattern matching)
    const isSeries = this.isTVSeries(decodedTitle);
    const cleanedTitle = this.cleanTitle(movie.title);

    let tmdbResult = null;

    if (isSeries) {
      // For TV series, use the first air date year if available, or try without year
      // Extract the earliest year from title (might be different from movie.year for multi-season entries)
      const titleYearMatch = movie.title.match(/\((\d{4})\)/);
      const searchYear = titleYearMatch ? titleYearMatch[1] : movie.year;

      // Search TV series (without season info)
      tmdbResult = await this.searchTVSeries(cleanedTitle, searchYear);

      if (tmdbResult) {
        const seasonNumber = this.extractSeasonNumber(movie.title);
        return {
          ...movie,
          tmdbId: tmdbResult.id,
          mediaType: 'tv',
          seasonNumber: seasonNumber,
          overview: tmdbResult.overview,
          posterPath: tmdbResult.poster_path,
          posterUrl: this.getPosterUrl(tmdbResult.poster_path, 'w780'),
          posterUrlLarge: this.getPosterUrl(tmdbResult.poster_path, 'original'),
          backdropPath: tmdbResult.backdrop_path,
          backdropUrl: tmdbResult.backdrop_path ?
            `${this.imageBaseUrl}original${tmdbResult.backdrop_path}` : null,
          voteAverage: tmdbResult.vote_average,
          releaseDate: tmdbResult.first_air_date,
          popularity: tmdbResult.popularity,
          originalName: tmdbResult.name || tmdbResult.original_name,
          seriesName: cleanedTitle
        };
      }

      // If TV series search failed, try without year
      if (!tmdbResult && searchYear) {
        tmdbResult = await this.searchTVSeries(cleanedTitle, null);
        if (tmdbResult) {
          const seasonNumber = this.extractSeasonNumber(movie.title);
          return {
            ...movie,
            tmdbId: tmdbResult.id,
            mediaType: 'tv',
            seasonNumber: seasonNumber,
            overview: tmdbResult.overview,
            posterPath: tmdbResult.poster_path,
            posterUrl: this.getPosterUrl(tmdbResult.poster_path, 'w780'),
            posterUrlLarge: this.getPosterUrl(tmdbResult.poster_path, 'original'),
            backdropPath: tmdbResult.backdrop_path,
            backdropUrl: tmdbResult.backdrop_path ?
              `${this.imageBaseUrl}original${tmdbResult.backdrop_path}` : null,
            voteAverage: tmdbResult.vote_average,
            releaseDate: tmdbResult.first_air_date,
            popularity: tmdbResult.popularity,
            originalName: tmdbResult.name || tmdbResult.original_name,
            seriesName: cleanedTitle
          };
        }
      }
    } else {
      // Search movies
      tmdbResult = await this.searchMovie(movie.title, movie.year);

      if (tmdbResult) {
        // Fetch full movie details to get tagline and IMDb ID
        const movieDetails = await this.getMovieDetails(tmdbResult.id);

        // Fetch Rotten Tomatoes score from OMDb if available
        let rottenTomatoes = null;
        if (this.omdbClient && movieDetails?.imdb_id) {
          const omdbData = await this.omdbClient.getMovieByImdbId(movieDetails.imdb_id);
          rottenTomatoes = omdbData?.rottenTomatoes || null;
        }

        return {
          ...movie,
          tmdbId: tmdbResult.id,
          mediaType: 'movie',
          overview: tmdbResult.overview,
          tagline: movieDetails?.tagline || null,
          imdbId: movieDetails?.imdb_id || null,
          rottenTomatoes: rottenTomatoes,
          posterPath: tmdbResult.poster_path,
          posterUrl: this.getPosterUrl(tmdbResult.poster_path, 'w780'),
          posterUrlLarge: this.getPosterUrl(tmdbResult.poster_path, 'original'),
          backdropPath: tmdbResult.backdrop_path,
          backdropUrl: tmdbResult.backdrop_path ?
            `${this.imageBaseUrl}original${tmdbResult.backdrop_path}` : null,
          voteAverage: tmdbResult.vote_average,
          releaseDate: tmdbResult.release_date,
          popularity: tmdbResult.popularity
        };
      }
    }

    return movie; // Return original if no match found
  }

  /**
   * Enrich multiple movies with TMDb metadata
   * @param {Array} movies - Array of movie objects
   * @param {number} batchSize - Number of concurrent requests
   * @param {number} delay - Delay between batches in ms
   */
  async enrichMovies(movies, batchSize = 5, delay = 200) {
    console.log(`Enriching ${movies.length} movies with TMDb metadata...`);

    const enrichedMovies = [];
    let processed = 0;
    let errors = 0;

    // Process in batches to avoid rate limiting
    for (let i = 0; i < movies.length; i += batchSize) {
      const batch = movies.slice(i, i + batchSize);

      // Add timeout and error handling for each movie
      const batchResults = await Promise.all(
        batch.map(async (movie) => {
          try {
            // Add 30 second timeout per movie
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 30000)
            );

            return await Promise.race([
              this.enrichMovie(movie),
              timeoutPromise
            ]);
          } catch (error) {
            errors++;
            if (errors <= 5) {
              console.error(`Error enriching "${movie.title}":`, error.message);
            }
            return movie; // Return original movie on error
          }
        })
      );

      enrichedMovies.push(...batchResults);
      processed += batch.length;

      // Log progress
      if (processed % 50 === 0 || processed === movies.length) {
        console.log(`TMDb enrichment progress: ${processed}/${movies.length}${errors > 0 ? ` (${errors} errors)` : ''}`);
      }

      // Delay between batches
      if (i + batchSize < movies.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const enrichedCount = enrichedMovies.filter(m => m.posterUrl).length;
    console.log(`TMDb enrichment complete: ${enrichedCount}/${movies.length} movies matched${errors > 0 ? ` (${errors} errors)` : ''}`);

    return enrichedMovies;
  }
}

module.exports = TMDBClient;
