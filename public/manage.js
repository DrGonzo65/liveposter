// Metadata Manager JavaScript

let allMovies = [];
let currentMovie = null;

// Load movies on page load
document.addEventListener('DOMContentLoaded', () => {
  loadMovies();

  // Set up filters
  document.getElementById('source-filter').addEventListener('change', filterMovies);
  document.getElementById('quality-filter').addEventListener('change', filterMovies);
  document.getElementById('search-input').addEventListener('input', filterMovies);
});

async function loadMovies() {
  try {
    const source = document.getElementById('source-filter').value;
    const response = await fetch(`/api/movies/all?source=${source}`);
    const data = await response.json();

    allMovies = data.movies;
    updateStats();
    displayMovies(allMovies);
  } catch (error) {
    console.error('Error loading movies:', error);
    document.getElementById('movies-grid').innerHTML = '<div class="loading">Error loading movies</div>';
  }
}

function updateStats() {
  const total = allMovies.length;
  const complete = allMovies.filter(m => m.metadataQuality.complete).length;
  const incomplete = total - complete;

  document.getElementById('total-count').textContent = total;
  document.getElementById('complete-count').textContent = complete;
  document.getElementById('incomplete-count').textContent = incomplete;
}

function displayMovies(movies) {
  const grid = document.getElementById('movies-grid');

  if (movies.length === 0) {
    grid.innerHTML = '<div class="loading">No movies found</div>';
    return;
  }

  grid.innerHTML = movies.map(movie => {
    const quality = movie.metadataQuality;
    const isIncomplete = !quality.complete;
    const posterUrl = movie.posterUrl || movie.posterUrlLarge || movie.thumb;
    const slideshowEnabled = movie.slideshowEnabled !== false;

    return `
      <div class="movie-card ${isIncomplete ? 'bad-metadata' : ''}" onclick="showMovieDetails('${escapeHtml(movie.title)}', '${movie.source}')">
        <div class="slideshow-toggle-card" onclick="event.stopPropagation(); toggleSlideshowFromGrid('${escapeHtml(movie.title)}', '${movie.source}', this)">
          <input type="checkbox" ${slideshowEnabled ? 'checked' : ''} title="${slideshowEnabled ? 'Enabled in slideshow' : 'Disabled in slideshow'}">
        </div>
        ${posterUrl
          ? `<img src="${posterUrl}" alt="${escapeHtml(movie.title)}" class="movie-poster">`
          : `<div class="movie-poster">No Poster</div>`
        }
        <div class="movie-info">
          <div class="movie-title">${escapeHtml(movie.title)}</div>
          <div class="movie-year">${movie.year || 'Unknown'}</div>
          <div class="quality-badges">
            <span class="badge ${quality.hasPoster ? 'good' : 'bad'}">Poster</span>
            <span class="badge ${quality.hasTagline ? 'good' : 'bad'}">Tagline</span>
            <span class="badge ${quality.hasRT ? 'good' : 'bad'}">RT</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterMovies() {
  const source = document.getElementById('source-filter').value;
  const quality = document.getElementById('quality-filter').value;
  const searchText = document.getElementById('search-input').value.toLowerCase();

  // Reload if source changed
  if (source !== 'all') {
    loadMovies();
    return;
  }

  let filtered = allMovies;

  // Filter by quality
  if (quality !== 'all') {
    filtered = filtered.filter(movie => {
      const q = movie.metadataQuality;
      switch (quality) {
        case 'incomplete':
          return !q.complete;
        case 'no-poster':
          return !q.hasPoster;
        case 'no-tagline':
          return !q.hasTagline;
        case 'no-rt':
          return !q.hasRT;
        default:
          return true;
      }
    });
  }

  // Filter by search text
  if (searchText) {
    filtered = filtered.filter(movie =>
      movie.title.toLowerCase().includes(searchText)
    );
  }

  displayMovies(filtered);
}

function showMovieDetails(title, source) {
  const movie = allMovies.find(m => m.title === title && m.source === source);
  if (!movie) return;

  currentMovie = movie;

  const posterUrl = movie.posterUrlLarge || movie.posterUrl || movie.thumb;
  const quality = movie.metadataQuality;

  document.getElementById('modal-title').textContent = movie.title;
  document.getElementById('movie-details').innerHTML = `
    <div>
      ${posterUrl
        ? `<img src="${posterUrl}" alt="${escapeHtml(movie.title)}" class="detail-poster">`
        : `<div class="detail-poster" style="background: #333; display: flex; align-items: center; justify-content: center; color: #666;">No Poster</div>`
      }
    </div>
    <div class="detail-info">
      <h3>${escapeHtml(movie.title)}</h3>
      <p><strong>Year:</strong> ${movie.year || 'Unknown'}</p>
      <p><strong>Source:</strong> ${movie.source}</p>
      <p><strong>TMDb ID:</strong> ${movie.tmdbId || 'Not matched'}</p>
      <p><strong>IMDb ID:</strong> ${movie.imdbId || 'N/A'}</p>
      <p><strong>Rating:</strong> ${movie.voteAverage ? `★ ${movie.voteAverage.toFixed(1)}` : 'N/A'}</p>
      <p><strong>RT Score:</strong> ${movie.rottenTomatoes || 'N/A'}</p>
      <p><strong>Tagline:</strong> ${movie.tagline || 'None'}</p>
      ${movie.overview ? `<p><strong>Overview:</strong> ${escapeHtml(movie.overview)}</p>` : ''}

      <h4 style="margin-top: 20px; margin-bottom: 10px;">Metadata Quality:</h4>
      <div class="quality-badges">
        <span class="badge ${quality.hasPoster ? 'good' : 'bad'}">Poster: ${quality.hasPoster ? '✓' : '✗'}</span>
        <span class="badge ${quality.hasTagline ? 'good' : 'bad'}">Tagline: ${quality.hasTagline ? '✓' : '✗'}</span>
        <span class="badge ${quality.hasRating ? 'good' : 'bad'}">Rating: ${quality.hasRating ? '✓' : '✗'}</span>
        <span class="badge ${quality.hasRT ? 'good' : 'bad'}">RT: ${quality.hasRT ? '✓' : '✗'}</span>
        <span class="badge ${quality.hasTmdb ? 'good' : 'bad'}">TMDb: ${quality.hasTmdb ? '✓' : '✗'}</span>
      </div>
    </div>
  `;

  // Pre-fill search form
  document.getElementById('alt-search-title').value = movie.title;
  document.getElementById('alt-search-year').value = movie.year || '';
  document.getElementById('search-results').innerHTML = '';

  // Set slideshow toggle (defaults to true if not explicitly set)
  document.getElementById('slideshow-enabled').checked = movie.slideshowEnabled !== false;

  document.getElementById('movie-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('movie-modal').classList.remove('active');
  currentMovie = null;
}

async function searchAlternatives() {
  const title = document.getElementById('alt-search-title').value;
  const year = document.getElementById('alt-search-year').value;
  const resultsDiv = document.getElementById('search-results');

  if (!title) {
    alert('Please enter a movie title');
    return;
  }

  resultsDiv.innerHTML = '<div class="loading">Searching TMDb...</div>';

  try {
    const response = await fetch(`/api/movies/search?title=${encodeURIComponent(title)}&year=${year}`);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      resultsDiv.innerHTML = data.results.map(result => `
        <div class="result-item">
          <div>
            ${result.posterUrl
              ? `<img src="${result.posterUrl}" alt="${escapeHtml(result.title)}" class="result-poster">`
              : `<div class="result-poster" style="background: #333; width: 80px; height: 120px;"></div>`
            }
          </div>
          <div class="result-info">
            <h4>${escapeHtml(result.title)} (${result.year || 'N/A'}) <span style="background: ${result.mediaType === 'tv' ? '#9333ea' : '#2563eb'}; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600;">${result.mediaType === 'tv' ? 'TV' : 'MOVIE'}</span></h4>
            <p><strong>TMDb ID:</strong> ${result.tmdbId}</p>
            <p><strong>Type:</strong> ${result.mediaType === 'tv' ? 'TV Series' : 'Movie'}</p>
            <p><strong>Rating:</strong> ${result.voteAverage ? `★ ${result.voteAverage.toFixed(1)}` : 'N/A'}</p>
            <p><strong>RT:</strong> ${result.rottenTomatoes || 'N/A'}</p>
            <p><strong>Tagline:</strong> ${result.tagline || 'None'}</p>
            ${result.overview ? `<p style="margin-top: 8px;">${escapeHtml(result.overview.substring(0, 150))}...</p>` : ''}
          </div>
          <div>
            <button onclick="applyMetadata(${result.tmdbId}, '${result.mediaType}')">Apply This Match</button>
          </div>
        </div>
      `).join('');
    } else {
      resultsDiv.innerHTML = '<div class="loading">No results found</div>';
    }
  } catch (error) {
    console.error('Error searching:', error);
    resultsDiv.innerHTML = '<div class="loading">Error searching TMDb</div>';
  }
}

async function applyMetadata(tmdbId, mediaType) {
  if (!currentMovie) return;

  if (!confirm(`Apply this metadata to "${currentMovie.title}"?`)) {
    return;
  }

  try {
    const response = await fetch('/api/movies/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: currentMovie.source,
        originalTitle: currentMovie.title,
        tmdbId: tmdbId,
        mediaType: mediaType || 'movie'
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('Metadata updated successfully!');
      closeModal();
      loadMovies(); // Reload the list
    } else {
      alert('Error updating metadata: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error updating metadata:', error);
    alert('Error updating metadata: ' + error.message);
  }
}

async function toggleSlideshow() {
  if (!currentMovie) return;

  const enabled = document.getElementById('slideshow-enabled').checked;

  try {
    const response = await fetch('/api/movies/toggle-slideshow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: currentMovie.source,
        title: currentMovie.title,
        enabled: enabled
      })
    });

    const result = await response.json();

    if (result.success) {
      currentMovie.slideshowEnabled = enabled;
      // Update in allMovies array
      const movieIndex = allMovies.findIndex(m =>
        m.title === currentMovie.title && m.source === currentMovie.source
      );
      if (movieIndex !== -1) {
        allMovies[movieIndex].slideshowEnabled = enabled;
      }
    } else {
      alert('Error updating slideshow setting: ' + (result.error || 'Unknown error'));
      // Revert checkbox
      document.getElementById('slideshow-enabled').checked = !enabled;
    }
  } catch (error) {
    console.error('Error toggling slideshow:', error);
    alert('Error updating slideshow setting: ' + error.message);
    // Revert checkbox
    document.getElementById('slideshow-enabled').checked = !enabled;
  }
}

async function toggleSlideshowFromGrid(title, source, element) {
  const checkbox = element.querySelector('input[type="checkbox"]');
  const enabled = checkbox.checked;

  try {
    const response = await fetch('/api/movies/toggle-slideshow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: source,
        title: title,
        enabled: enabled
      })
    });

    const result = await response.json();

    if (result.success) {
      // Update in allMovies array
      const movieIndex = allMovies.findIndex(m =>
        m.title === title && m.source === source
      );
      if (movieIndex !== -1) {
        allMovies[movieIndex].slideshowEnabled = enabled;
      }
      // Update tooltip
      checkbox.title = enabled ? 'Enabled in slideshow' : 'Disabled in slideshow';
    } else {
      alert('Error updating slideshow setting: ' + (result.error || 'Unknown error'));
      // Revert checkbox
      checkbox.checked = !enabled;
    }
  } catch (error) {
    console.error('Error toggling slideshow:', error);
    alert('Error updating slideshow setting: ' + error.message);
    // Revert checkbox
    checkbox.checked = !enabled;
  }
}

function escapeHtml(text) {
  // First decode any HTML entities, then escape for display
  const div = document.createElement('div');
  div.innerHTML = text;
  const decoded = div.textContent;
  div.textContent = decoded;
  return div.innerHTML;
}

function decodeHtml(text) {
  const div = document.createElement('div');
  div.innerHTML = text;
  return div.textContent;
}

// Close modal when clicking outside
document.getElementById('movie-modal').addEventListener('click', (e) => {
  if (e.target.id === 'movie-modal') {
    closeModal();
  }
});

document.getElementById('settings-modal').addEventListener('click', (e) => {
  if (e.target.id === 'settings-modal') {
    closeSettings();
  }
});

// Settings Management
async function openSettings() {
  try {
    const response = await fetch('/api/settings');
    const settings = await response.json();

    // Populate form
    document.getElementById('tmdb-key').value = settings.tmdb?.apiKey || '';
    document.getElementById('tmdb-token').value = settings.tmdb?.readToken || '';
    document.getElementById('omdb-key').value = settings.omdb?.apiKey || '';
    document.getElementById('k-player-host').value = settings.kaleidescape?.playerHost || '';
    document.getElementById('k-port').value = settings.kaleidescape?.port || '';
    document.getElementById('k-server-host').value = settings.kaleidescape?.serverHost || '';
    document.getElementById('plex-url').value = settings.plex?.url || '';
    document.getElementById('plex-token').value = settings.plex?.token || '';
    document.getElementById('jellyfin-url').value = settings.jellyfin?.url || '';
    document.getElementById('jellyfin-key').value = settings.jellyfin?.apiKey || '';
    // Convert milliseconds to seconds for display
    document.getElementById('poll-interval').value = (settings.pollInterval || 10000) / 1000;
    document.getElementById('slideshow-interval').value = (settings.slideshowInterval || 30000) / 1000;

    // Load display scale from server settings
    const displayScale = settings.displayScale || 1.0;
    document.getElementById('display-scale').value = displayScale;
    document.getElementById('scale-value').textContent = displayScale;

    // Load allowed ratings
    const allowedRatings = settings.allowedRatings || ['G', 'PG', 'PG-13', 'R', 'NC-17', 'NR'];
    document.getElementById('rating-g').checked = allowedRatings.includes('G');
    document.getElementById('rating-pg').checked = allowedRatings.includes('PG');
    document.getElementById('rating-pg13').checked = allowedRatings.includes('PG-13');
    document.getElementById('rating-r').checked = allowedRatings.includes('R');
    document.getElementById('rating-nc17').checked = allowedRatings.includes('NC-17');
    document.getElementById('rating-nr').checked = allowedRatings.includes('NR');

    document.getElementById('settings-modal').classList.add('active');
  } catch (error) {
    console.error('Error loading settings:', error);
    alert('Error loading settings: ' + error.message);
  }
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('active');
}

function updateScaleValue(value) {
  document.getElementById('scale-value').textContent = value;
}

async function saveSettings(event) {
  event.preventDefault();

  const settings = {
    tmdb: {
      apiKey: document.getElementById('tmdb-key').value,
      readToken: document.getElementById('tmdb-token').value
    },
    omdb: {
      apiKey: document.getElementById('omdb-key').value
    },
    kaleidescape: {
      playerHost: document.getElementById('k-player-host').value,
      port: parseInt(document.getElementById('k-port').value) || 10000,
      serverHost: document.getElementById('k-server-host').value || undefined
    },
    plex: {
      url: document.getElementById('plex-url').value,
      token: document.getElementById('plex-token').value
    },
    jellyfin: {
      url: document.getElementById('jellyfin-url').value,
      apiKey: document.getElementById('jellyfin-key').value
    },
    // Convert seconds to milliseconds for server
    pollInterval: (parseInt(document.getElementById('poll-interval').value) || 10) * 1000,
    slideshowInterval: (parseInt(document.getElementById('slideshow-interval').value) || 30) * 1000,
    displayScale: parseFloat(document.getElementById('display-scale').value) || 1.0,
    // Collect allowed ratings
    allowedRatings: [
      document.getElementById('rating-g').checked && 'G',
      document.getElementById('rating-pg').checked && 'PG',
      document.getElementById('rating-pg13').checked && 'PG-13',
      document.getElementById('rating-r').checked && 'R',
      document.getElementById('rating-nc17').checked && 'NC-17',
      document.getElementById('rating-nr').checked && 'NR'
    ].filter(Boolean)
  };

  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });

    const result = await response.json();

    if (result.success) {
      alert('Settings saved successfully!\n\nDisplay scale will update automatically within a few seconds.\nOther settings require a server restart to take effect.');
      closeSettings();
    } else {
      alert('Error saving settings: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Error saving settings: ' + error.message);
  }
}

async function clearCache() {
  if (!confirm('This will clear all cached metadata and restart the server. The server will re-fetch all movie data from TMDb, which may take a few minutes. Continue?')) {
    return;
  }

  try {
    const response = await fetch('/api/clear-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      alert('Cache cleared! Server is restarting...\n\nPlease wait about 30 seconds for the server to reload all metadata, then refresh this page.');
      closeSettings();
    } else {
      alert('Error clearing cache: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    alert('Cache cleared and server is restarting. Please wait about 30 seconds, then refresh this page.');
  }
}
