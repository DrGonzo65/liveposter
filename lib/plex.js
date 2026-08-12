const axios = require('axios');

/**
 * Plex Media Server Integration
 */
class PlexClient {
  constructor(url, token) {
    this.url = url.replace(/\/$/, ''); // Remove trailing slash
    this.token = token;

    this.axios = axios.create({
      baseURL: this.url,
      params: {
        'X-Plex-Token': token
      },
      headers: {
        'Accept': 'application/json',
        'X-Plex-Client-Identifier': 'liveposter',
        'X-Plex-Product': 'LivePoster',
        'X-Plex-Version': '1.0'
      }
    });
  }

  async getSessions() {
    try {
      const response = await this.axios.get('/status/sessions');
      return response.data;
    } catch (error) {
      // Only log errors occasionally to avoid spam
      if (!this.lastError || this.lastError !== error.message) {
        console.error('Error getting Plex sessions:', error.message);
        this.lastError = error.message;
      }
      return null;
    }
  }

  async getNowPlaying() {
    try {
      const sessions = await this.getSessions();

      if (!sessions || !sessions.MediaContainer || !sessions.MediaContainer.Metadata) {
        return null;
      }

      const metadata = sessions.MediaContainer.Metadata;
      if (!Array.isArray(metadata) || metadata.length === 0) {
        return null;
      }

      // Get the first playing session
      const playing = metadata[0];

      return {
        playing: true,
        type: playing.type, // movie, episode, track
        title: playing.title,
        grandparentTitle: playing.grandparentTitle, // Show name for episodes
        parentTitle: playing.parentTitle, // Season for episodes
        year: playing.year,
        thumb: this.getImageUrl(playing.thumb || playing.grandparentThumb),
        art: this.getImageUrl(playing.art || playing.grandparentArt),
        rating: playing.rating,
        summary: playing.summary,
        duration: playing.duration,
        viewOffset: playing.viewOffset,
        playerState: playing.Player?.[0]?.state, // playing, paused
        source: 'plex'
      };
    } catch (error) {
      console.error('Error getting Plex now playing:', error.message);
      return null;
    }
  }

  async getLibraries() {
    try {
      const response = await this.axios.get('/library/sections');
      return response.data.MediaContainer?.Directory || [];
    } catch (error) {
      console.error('Error getting Plex libraries:', error.message);
      return [];
    }
  }

  async getMovieLibrary() {
    try {
      const libraries = await this.getLibraries();
      const movieLibrary = libraries.find(lib => lib.type === 'movie');

      if (!movieLibrary) {
        return [];
      }

      const response = await this.axios.get(`/library/sections/${movieLibrary.key}/all`);
      const movies = response.data;

      if (!movies || !movies.MediaContainer || !movies.MediaContainer.Metadata) {
        return [];
      }

      return movies.MediaContainer.Metadata.map(movie => ({
        title: movie.title,
        year: movie.year,
        thumb: this.getImageUrl(movie.thumb),
        art: this.getImageUrl(movie.art),
        rating: movie.rating,
        summary: movie.summary,
        source: 'plex'
      }));
    } catch (error) {
      console.error('Error getting Plex movie library:', error.message);
      return [];
    }
  }

  getImageUrl(path) {
    if (!path) return null;
    return `${this.url}${path}?X-Plex-Token=${this.token}`;
  }

  async testConnection() {
    try {
      const response = await this.axios.get('/');
      return response.status === 200 && response.data.MediaContainer;
    } catch (error) {
      console.error('Plex connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = PlexClient;
