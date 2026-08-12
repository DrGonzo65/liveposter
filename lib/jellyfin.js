const axios = require('axios');

/**
 * Jellyfin Media Server Integration
 */
class JellyfinClient {
  constructor(url, apiKey) {
    this.url = url.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.axios = axios.create({
      baseURL: this.url,
      headers: {
        'X-Emby-Token': apiKey
      }
    });
  }

  async getSessions() {
    try {
      const response = await this.axios.get('/Sessions');
      return response.data;
    } catch (error) {
      // Only log errors occasionally to avoid spam
      if (!this.lastError || this.lastError !== error.message) {
        console.error('Error getting Jellyfin sessions:', error.message);
        this.lastError = error.message;
      }
      return null;
    }
  }

  async getNowPlaying() {
    try {
      const sessions = await this.getSessions();

      if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
        return null;
      }

      // Find first session with NowPlayingItem
      const playingSession = sessions.find(s => s.NowPlayingItem);

      if (!playingSession || !playingSession.NowPlayingItem) {
        return null;
      }

      const item = playingSession.NowPlayingItem;

      return {
        playing: true,
        type: item.Type.toLowerCase(), // movie, episode, audio
        title: item.Name,
        seriesName: item.SeriesName, // For episodes
        seasonName: item.SeasonName, // For episodes
        year: item.ProductionYear,
        thumb: this.getImageUrl(item.Id, 'Primary'),
        backdrop: this.getImageUrl(item.Id, 'Backdrop'),
        rating: item.CommunityRating,
        officialRating: item.OfficialRating,
        summary: item.Overview,
        duration: item.RunTimeTicks ? item.RunTimeTicks / 10000 : null, // Convert ticks to milliseconds
        viewOffset: playingSession.PlayState?.PositionTicks ? playingSession.PlayState.PositionTicks / 10000 : null, // Convert ticks to milliseconds
        playerState: playingSession.PlayState?.IsPaused ? 'paused' : 'playing',
        source: 'jellyfin'
      };
    } catch (error) {
      console.error('Error getting Jellyfin now playing:', error.message);
      return null;
    }
  }

  async getMovieLibrary() {
    try {
      // Get all libraries
      const librariesResponse = await this.axios.get('/Library/MediaFolders');
      const libraries = librariesResponse.data.Items;

      // Find movie libraries
      const movieLibraries = libraries.filter(lib =>
        lib.CollectionType === 'movies'
      );

      if (movieLibraries.length === 0) {
        return [];
      }

      // Get movies from first movie library
      const libraryId = movieLibraries[0].Id;
      const moviesResponse = await this.axios.get('/Items', {
        params: {
          ParentId: libraryId,
          IncludeItemTypes: 'Movie',
          Recursive: true,
          Fields: 'Overview,CommunityRating,OfficialRating',
          SortBy: 'SortName',
          SortOrder: 'Ascending'
        }
      });

      const movies = moviesResponse.data.Items || [];

      return movies.map(movie => ({
        title: movie.Name,
        year: movie.ProductionYear,
        thumb: this.getImageUrl(movie.Id, 'Primary'),
        backdrop: this.getImageUrl(movie.Id, 'Backdrop'),
        rating: movie.CommunityRating,
        officialRating: movie.OfficialRating,
        summary: movie.Overview,
        source: 'jellyfin'
      }));
    } catch (error) {
      console.error('Error getting Jellyfin movie library:', error.message);
      return [];
    }
  }

  getImageUrl(itemId, imageType = 'Primary') {
    if (!itemId) return null;
    return `${this.url}/Items/${itemId}/Images/${imageType}?api_key=${this.apiKey}`;
  }

  async testConnection() {
    try {
      const response = await this.axios.get('/System/Info');
      return response.status === 200;
    } catch (error) {
      if (error.code === 'EHOSTUNREACH' || error.code === 'ENOTFOUND') {
        console.error(`Jellyfin connection failed: Cannot reach ${this.url}`);
      } else if (error.code === 'ECONNREFUSED') {
        console.error(`Jellyfin connection failed: Connection refused at ${this.url}`);
      } else {
        console.error('Jellyfin connection test failed:', error.message);
      }
      return false;
    }
  }
}

module.exports = JellyfinClient;
