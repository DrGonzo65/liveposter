// LivePoster Frontend Application

class LivePoster {
  constructor() {
    this.config = null;
    this.currentState = null;
    this.slideshowTimer = null;
    this.checkInterval = null;
    this.isTransitioning = false;
    this.clientLoadTime = Date.now();
    this.fadeMs = 800;   // replaced with the real CSS duration once the DOM is up

    // DOM elements
    this.elements = {
      loading: document.getElementById('loading'),
      posterContainer: document.getElementById('poster-container'),
      backdrop: document.getElementById('backdrop'),
      posterImage: document.getElementById('poster-image'),
      title: document.getElementById('title'),
      tagline: document.getElementById('tagline'),
      year: document.getElementById('year'),
      rating: document.getElementById('rating'),
      rtScore: document.getElementById('rt-score'),
      source: document.getElementById('source'),
      nowPlaying: document.getElementById('now-playing'),
      comingSoon: document.getElementById('coming-soon'),
      status: document.getElementById('status-text'),
      progressContainer: document.getElementById('progress-container'),
      progressFill: document.getElementById('progress-fill'),
      currentTime: document.getElementById('current-time'),
      totalTime: document.getElementById('total-time')
    };

    this.init();
  }

  async init() {
    console.log('Initializing LivePoster...');

    try {
      // Wait for server to finish loading
      await this.waitForServerReady();

      // Load configuration
      await this.loadConfig();

      // Hide loading screen
      this.elements.loading.classList.add('hidden');
      this.elements.posterContainer.classList.add('visible');

      // Take the fade length from the stylesheet so the two can't drift apart
      const declared = parseFloat(getComputedStyle(this.elements.posterContainer).transitionDuration);
      if (declared > 0) this.fadeMs = declared * 1000;

      // Start checking for playback
      this.startChecking();

      // Start polling for display scale changes
      this.startScalePolling();

      // Start checking for server restarts (auto-reload)
      this.startServerRestartDetection();

      console.log('LivePoster initialized successfully');
    } catch (error) {
      console.error('Failed to initialize:', error);
      this.showError('Failed to connect to server');
    }
  }

  async startScalePolling() {
    // Fetch initial scale
    await this.fetchAndApplyScale();

    // Poll for changes every 2 seconds
    setInterval(async () => {
      await this.fetchAndApplyScale();
    }, 2000);
  }

  async fetchAndApplyScale() {
    try {
      const response = await fetch('/api/display-scale');
      const data = await response.json();
      const scale = data.scale || 1.0;

      this.applyScale(scale);
    } catch (error) {
      console.error('Error fetching display scale:', error);
    }
  }

  applyScale(scaleValue) {
    const baseFontSize = 16; // Default browser font size
    const newFontSize = baseFontSize * scaleValue;

    // Scale text by adjusting the root font size
    const currentFontSize = document.documentElement.style.fontSize;
    const expectedFontSize = `${newFontSize}px`;

    // Only update if changed to avoid unnecessary reflows
    if (currentFontSize !== expectedFontSize) {
      document.documentElement.style.fontSize = expectedFontSize;
      console.log(`Applied text scale: ${scaleValue}x (${newFontSize}px base)`);
    }
  }

  async startServerRestartDetection() {
    // Check every 10 seconds if server was restarted
    setInterval(async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();

        // If server started after this client loaded, reload the page
        if (data.serverStartTime && data.serverStartTime > this.clientLoadTime) {
          console.log('Server was restarted, reloading page...');
          window.location.reload();
        }
      } catch (error) {
        // Server might be restarting, don't log error
      }
    }, 10000);
  }

  async waitForServerReady() {
    const loadingElement = this.elements.loading;
    const loadingText = loadingElement.querySelector('p');
    const logsContainer = document.getElementById('loading-logs');

    while (true) {
      try {
        const response = await fetch('/api/loading');
        const data = await response.json();

        // Check if setup is needed
        if (data.needsSetup) {
          this.showSetupMessage(data.configured);
          await this.sleep(5000); // Check again in 5 seconds
          continue;
        }

        if (data.ready) {
          console.log('Server ready!');
          return;
        }

        // Update loading message
        if (data.progress && data.progress.status) {
          loadingText.textContent = data.progress.status;
        } else {
          loadingText.textContent = 'Loading media library...';
        }

        // Update logs
        if (data.progress && data.progress.logs && data.progress.logs.length > 0 && logsContainer) {
          const latestLogs = data.progress.logs.slice(-10); // Show last 10 logs
          logsContainer.innerHTML = latestLogs
            .map(log => `<div class="log-line">${this.escapeHtml(log.message)}</div>`)
            .join('');
          // Auto-scroll to bottom
          logsContainer.scrollTop = logsContainer.scrollHeight;
        }

        // Wait 1 second before checking again
        await this.sleep(1000);
      } catch (error) {
        console.error('Error checking server status:', error);
        loadingText.textContent = 'Connecting to server...';
        await this.sleep(2000);
      }
    }
  }

  async loadConfig() {
    const response = await fetch('/api/config');
    this.config = await response.json();
    console.log('Config loaded:', this.config);
  }

  startChecking() {
    // Check immediately
    this.checkStatus();

    // Then check at regular intervals
    this.checkInterval = setInterval(() => {
      this.checkStatus();
    }, 5000); // Check every 5 seconds
  }

  async checkStatus() {
    try {
      const response = await fetch('/api/status');
      const state = await response.json();

      const wasPlaying = this.currentState?.playing;
      const isPlaying = state.playing;

      this.currentState = state;

      if (isPlaying && state.content) {
        // Something is playing
        this.stopSlideshow();
        this.displayNowPlaying(state.content);
      } else if (wasPlaying && !isPlaying) {
        // Playback stopped, start slideshow
        this.startSlideshow();
      } else if (!isPlaying && !this.slideshowTimer) {
        // Nothing playing and slideshow not running
        this.startSlideshow();
      }

      this.updateStatus();
    } catch (error) {
      console.error('Error checking status:', error);
      this.updateStatus('Connection error');
    }
  }

  displayNowPlaying(content) {
    console.log('Displaying now playing:', content.title);

    // Show now playing indicator, hide coming soon
    this.elements.nowPlaying.classList.remove('hidden');
    this.elements.comingSoon.classList.add('hidden');

    // Show progress bar if we have duration info
    if (content.duration && content.viewOffset !== undefined) {
      this.updateProgress(content.viewOffset, content.duration);
      this.elements.progressContainer.classList.remove('hidden');
    } else {
      this.elements.progressContainer.classList.add('hidden');
    }

    // Update display
    this.displayContent(content);
  }

  async startSlideshow() {
    console.log('Starting slideshow...');

    // Hide now playing indicator, show coming soon
    this.elements.nowPlaying.classList.add('hidden');
    this.elements.comingSoon.classList.remove('hidden');

    // Hide progress bar
    this.elements.progressContainer.classList.add('hidden');

    // Show first slide immediately
    await this.showNextSlide();

    // Then continue showing slides at interval
    this.slideshowTimer = setInterval(() => {
      this.showNextSlide();
    }, this.config.slideshowInterval || 30000);
  }

  stopSlideshow() {
    if (this.slideshowTimer) {
      console.log('Stopping slideshow');
      clearInterval(this.slideshowTimer);
      this.slideshowTimer = null;
    }
  }

  async showNextSlide() {
    try {
      const response = await fetch('/api/random?source=all');
      const movie = await response.json();

      if (movie) {
        console.log('Showing slide:', movie.title);
        this.displayContent(movie);
      }
    } catch (error) {
      console.error('Error loading random movie:', error);
    }
  }

  /**
   * Fade the slide out and resolve when it has actually finished.
   *
   * The old code slept 500ms against an 800ms CSS transition, so the slide was
   * still a quarter visible when the next poster was swapped in.
   */
  fadeOut() {
    const el = this.elements.posterContainer;

    return new Promise((resolve) => {
      if (getComputedStyle(el).opacity === '0') {
        el.classList.add('fade-out');
        return resolve();
      }

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        el.removeEventListener('transitionend', onEnd);
        clearTimeout(timer);
        resolve();
      };

      const onEnd = (event) => {
        if (event.propertyName === 'opacity') finish();
      };

      el.addEventListener('transitionend', onEnd);
      // transitionend never fires in a background tab, so don't rely on it alone
      const timer = setTimeout(finish, this.fadeMs + 250);

      el.classList.add('fade-out');
    });
  }

  fadeIn() {
    // Only ever toggle fade-out. Adding a competing fade-in class left it stuck
    // on the element, and since it is declared after fade-out with the same
    // specificity and !important, every later fade-out was cancelled out.
    this.elements.posterContainer.classList.remove('fade-out');
  }

  async displayContent(content) {
    if (this.isTransitioning) return;

    this.isTransitioning = true;

    try {
      // Update content - prioritize Kaleidescape hi-res, TMDb original, then others
      const posterUrl = content.coverUrl || content.posterUrlLarge || content.posterUrl || content.thumb || content.art;
      const backdropUrl = content.backdropUrl || content.art || content.backdrop;

      // Fetch artwork while the current slide fades out so the two overlap.
      // Failures resolve rather than reject - a missing backdrop shouldn't
      // block the title from changing.
      const artworkReady = Promise.all([
        posterUrl ? this.loadImage(posterUrl).catch(err => console.error('Poster failed to load:', err.message)) : null,
        backdropUrl ? this.loadImage(backdropUrl).catch(err => console.error('Backdrop failed to load:', err.message)) : null
      ]);

      await Promise.all([artworkReady, this.fadeOut()]);

      // Invisible now, so artwork and text can be swapped in the same breath.
      // Both are already in the browser cache, so this paints as one change.
      if (posterUrl) {
        this.elements.posterImage.src = posterUrl;
        this.elements.posterImage.alt = content.title || 'Movie Poster';
      }

      if (backdropUrl) {
        this.elements.backdrop.style.backgroundImage = `url(${backdropUrl})`;
      }

      this.updateText(content);

      // Guarantee the new poster is decoded before it becomes visible
      if (posterUrl && this.elements.posterImage.decode) {
        try {
          await this.elements.posterImage.decode();
        } catch (error) {
          // Decode rejects if the src changed again; the fade-in is still fine
        }
      }

      this.fadeIn();
    } finally {
      this.isTransitioning = false;
    }
  }

  updateText(content) {
    this.elements.title.textContent = this.getDisplayTitle(content);

    // Extract and display tagline (first sentence or short version of overview)
    const tagline = this.getTagline(content);
    this.elements.tagline.textContent = tagline;

    this.elements.year.textContent = content.year || '';

    // Show rating from TMDb or content rating
    if (content.voteAverage) {
      this.elements.rating.textContent = `★ ${content.voteAverage.toFixed(1)}`;
      this.elements.rating.style.display = 'flex';
    } else if (content.rating || content.officialRating) {
      this.elements.rating.textContent = content.rating || content.officialRating;
      this.elements.rating.style.display = 'flex';
    } else {
      this.elements.rating.style.display = 'none';
    }

    // Show Rotten Tomatoes score if available
    if (content.rottenTomatoes) {
      this.elements.rtScore.innerHTML = `<img src="rotten-tomatoes.svg" alt="RT" style="height: 1.2em; width: auto; margin-right: 0.3em;"> ${content.rottenTomatoes}`;
      this.elements.rtScore.style.display = 'flex';
    } else {
      this.elements.rtScore.style.display = 'none';
    }

    // Show source with logo for Kaleidescape
    const source = content.source || 'Unknown';
    if (source.toLowerCase() === 'kaleidescape') {
      this.elements.source.innerHTML = '<img src="kaleidescape-logo.svg" alt="Kaleidescape">';
    } else {
      this.elements.source.textContent = source.toUpperCase();
    }
  }

  decodeHtmlEntities(text) {
    if (!text) return text;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  getDisplayTitle(content) {
    if (content.type === 'episode') {
      // TV Episode: "Show Name - Episode Title"
      const showName = content.seriesName || content.grandparentTitle || '';
      const episodeTitle = content.title || '';
      const title = showName && episodeTitle ? `${showName} - ${episodeTitle}` : content.title;
      return this.decodeHtmlEntities(title);
    }

    return this.decodeHtmlEntities(content.title || 'Unknown');
  }

  getTagline(content) {
    // Use TMDb tagline if available
    if (content.tagline) {
      return this.decodeHtmlEntities(content.tagline);
    }

    // Fallback: extract from overview for movies without taglines
    const overview = content.overview || content.summary || '';
    if (!overview) return '';

    // Try to get the first sentence
    const firstSentence = overview.match(/^[^.!?]+[.!?]/);
    if (firstSentence) {
      const sentence = firstSentence[0].trim();
      // If the sentence is reasonably short (under 100 chars), use it
      if (sentence.length < 100) {
        return this.decodeHtmlEntities(sentence);
      }
    }

    // Otherwise, truncate to ~80 characters at word boundary
    const decodedOverview = this.decodeHtmlEntities(overview);
    if (decodedOverview.length > 80) {
      const truncated = decodedOverview.substring(0, 80);
      const lastSpace = truncated.lastIndexOf(' ');
      return truncated.substring(0, lastSpace) + '...';
    }

    return decodedOverview;
  }

  updateStatus(message = null) {
    if (message) {
      this.elements.status.textContent = message;
      return;
    }

    if (this.currentState?.playing) {
      const source = this.currentState.source || 'Unknown';
      this.elements.status.textContent = `Playing on ${source}`;
    } else if (this.slideshowTimer) {
      this.elements.status.textContent = 'Slideshow';
    } else {
      this.elements.status.textContent = 'Idle';
    }
  }

  showError(message) {
    this.elements.loading.innerHTML = `
      <div style="text-align: center;">
        <h2 style="color: #dc2626; margin-bottom: 10px;">Error</h2>
        <p>${message}</p>
      </div>
    `;
  }

  showSetupMessage(configured) {
    const missing = [];
    if (!configured.kaleidescape && !configured.plex && !configured.jellyfin) {
      missing.push('media server (Kaleidescape, Plex, or Jellyfin)');
    }
    if (!configured.tmdb) {
      missing.push('TMDb API credentials');
    }

    this.elements.loading.innerHTML = `
      <div style="text-align: center; max-width: 600px; margin: 0 auto;">
        <div style="font-size: 4rem; margin-bottom: 20px;">⚙️</div>
        <h2 style="margin-bottom: 20px; font-size: 2rem; font-weight: 700;">Setup Required</h2>
        <p style="margin-bottom: 30px; font-size: 1.2rem; color: rgba(255, 255, 255, 0.7);">
          LivePoster needs to be configured before it can display content.
        </p>
        <div style="text-align: left; background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h3 style="margin-bottom: 15px; font-size: 1.1rem;">Missing Configuration:</h3>
          <ul style="list-style: none; padding: 0; font-size: 1rem; line-height: 1.8;">
            ${missing.map(item => `<li style="padding: 5px 0;">❌ ${item}</li>`).join('')}
          </ul>
        </div>
        <a href="/manage.html" style="display: inline-block; padding: 15px 40px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-size: 1.2rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
          Open Settings
        </a>
        <p style="margin-top: 20px; font-size: 0.9rem; color: rgba(255, 255, 255, 0.5);">
          This page will automatically refresh once configuration is complete
        </p>
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateProgress(currentMs, totalMs) {
    // Calculate progress percentage
    const percentage = (currentMs / totalMs) * 100;
    this.elements.progressFill.style.width = `${percentage}%`;

    // Update time displays
    this.elements.currentTime.textContent = this.formatTime(currentMs);
    this.elements.totalTime.textContent = this.formatTime(totalMs);
  }

  formatTime(milliseconds) {
    // Convert Jellyfin ticks to milliseconds if needed (ticks are in 100ns units)
    // But we're already converting in the backend, so this should be milliseconds
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }
}

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new LivePoster();
  });
} else {
  new LivePoster();
}
