const axios = require('axios');

/**
 * OMDb API Client for Rotten Tomatoes scores
 */
class OMDbClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'http://www.omdbapi.com/';
  }

  /**
   * Get movie details including Rotten Tomatoes score
   */
  async getMovieByTitle(title, year) {
    if (!this.apiKey) {
      return null;
    }

    try {
      const params = {
        apikey: this.apiKey,
        t: title,
        type: 'movie'
      };

      if (year) {
        params.y = year;
      }

      const response = await axios.get(this.baseUrl, { params });

      if (response.data && response.data.Response === 'True') {
        const ratings = response.data.Ratings || [];
        const rtRating = ratings.find(r => r.Source === 'Rotten Tomatoes');

        return {
          rottenTomatoes: rtRating ? rtRating.Value : null,
          imdbRating: response.data.imdbRating,
          imdbID: response.data.imdbID
        };
      }

      return null;
    } catch (error) {
      console.error(`Error fetching OMDb data for "${title}":`, error.message);
      return null;
    }
  }

  /**
   * Get movie details by IMDb ID
   */
  async getMovieByImdbId(imdbId) {
    if (!this.apiKey) {
      return null;
    }

    try {
      const params = {
        apikey: this.apiKey,
        i: imdbId
      };

      const response = await axios.get(this.baseUrl, { params });

      if (response.data && response.data.Response === 'True') {
        const ratings = response.data.Ratings || [];
        const rtRating = ratings.find(r => r.Source === 'Rotten Tomatoes');

        return {
          rottenTomatoes: rtRating ? rtRating.Value : null,
          imdbRating: response.data.imdbRating,
          imdbID: response.data.imdbID
        };
      }

      return null;
    } catch (error) {
      console.error(`Error fetching OMDb data for IMDb ID "${imdbId}":`, error.message);
      return null;
    }
  }
}

module.exports = OMDbClient;
