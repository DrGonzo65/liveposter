# LivePoster Setup Guide

A complete walk-through for setting up LivePoster on your own system. If you only
need Docker deployment specifics, see [DOCKER.md](DOCKER.md).

**Contents**

1. [What you need](#1-what-you-need)
2. [TMDb credentials (required)](#2-tmdb-credentials-required)
3. [Rotten Tomatoes scores (optional)](#3-rotten-tomatoes-scores-optional)
4. [Kaleidescape: which address goes where](#4-kaleidescape-which-address-goes-where)
5. [Jellyfin and Plex](#5-jellyfin-and-plex)
6. [Running it](#6-running-it)
7. [First run](#7-first-run)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. What you need

- **A TMDb account** — free, and required. LivePoster has no poster artwork of its
  own; every poster and tagline comes from TMDb.
- **At least one media system** — Kaleidescape, Jellyfin, or Plex.
- **Somewhere to run it** — Docker (including Unraid), or Node.js 18+.
- **A display** — any browser pointed at the server. A wall-mounted screen or
  tablet in kiosk mode is the intended use.

LivePoster starts fine with nothing configured. It shows a **Setup Required**
screen listing what's missing, so you can install first and configure after.

---

## 2. TMDb credentials (required)

TMDb issues **two** credentials and LivePoster needs both. This trips people up —
the older "API Key" and the newer "Read Access Token" are different strings.

1. Create a free account at <https://www.themoviedb.org/signup>
2. Go to **Settings → API** (<https://www.themoviedb.org/settings/api>)
3. Request an API key — choose "Developer", accept the terms, and fill in the
   form. A personal/home use description is fine.
4. From the API settings page copy both:
   - **API Key (v3 auth)** → `TMDB_API_KEY` — a 32-character hex string
   - **API Read Access Token (v4 auth)** → `TMDB_READ_TOKEN` — a long token
     beginning `eyJ...`

```bash
TMDB_API_KEY=0123456789abcdef0123456789abcdef
TMDB_READ_TOKEN=eyJhbGciOiJIUzI1NiJ9...
```

If only one is set, LivePoster keeps showing the Setup Required screen.

---

## 3. Rotten Tomatoes scores (optional)

Rotten Tomatoes percentages come from OMDb. Skip this and everything works;
posters simply won't show an RT score.

1. Get a free key at <http://www.omdbapi.com/apikey.aspx> (the free tier allows
   1,000 lookups per day — enough for an initial library scan of about that many
   titles; scores are cached afterwards)
2. Verify the activation email
3. Set `OMDB_API_KEY`

---

## 4. Kaleidescape: which address goes where

**This is the one setting people get wrong.** Read this section even if you only
have one Kaleidescape box.

LivePoster asks your Kaleidescape system for two different things:

| It needs | It asks | Setting |
|---|---|---|
| What's playing right now | the **player**, over the control protocol on port 10000 | `KALEIDESCAPE_PLAYER_HOST` |
| Your movie library, for the idle slideshow | the device that **holds the movies**, over HTTP on port 80 | `KALEIDESCAPE_SERVER_HOST` |

On some systems that's one device. On others it's two.

### If your player has built-in storage — use one address

All-in-one systems (a **Strato V**, or any player with internal storage) both
play movies and hold the library. Set the one address and **leave
`KALEIDESCAPE_SERVER_HOST` blank** — LivePoster falls back to `KALEIDESCAPE_PLAYER_HOST`
automatically.

```bash
KALEIDESCAPE_PLAYER_HOST=192.168.1.50
KALEIDESCAPE_PORT=10000
KALEIDESCAPE_SERVER_HOST=
```

### If your movies live on a separate server — use two addresses

Systems with a dedicated movie server (a **Terra**) paired with one or more
players need both. The player reports playback; the Terra holds the library.

```bash
KALEIDESCAPE_PLAYER_HOST=192.168.1.50        # the player
KALEIDESCAPE_PORT=10000
KALEIDESCAPE_SERVER_HOST=192.168.1.51   # the Terra movie server
```

Pointing `KALEIDESCAPE_PLAYER_HOST` at a Terra is the classic mistake. The library loads
and the slideshow runs perfectly, so it looks like it's working — but a movie
server has no playback zone, so **"Now Playing" never appears.**

### Identify your devices

Don't guess from the model number — ask the hardware. Find the IP addresses in
the Kaleidescape app or your router's DHCP list, then run these against each one.

**Which device is this?**

```bash
{ printf '01/1/GET_DEVICE_TYPE_NAME:\r\n'; sleep 2; } | nc 192.168.1.50 10000
```

A player answers:

```
01/1/000:DEVICE_TYPE_NAME:Player:/59
```

A movie server answers something like:

```
01/1/000:DEVICE_TYPE_NAME:Terra Prime Movie Server (HDD):/17
```

**Can it report playback?** (this is what `KALEIDESCAPE_PLAYER_HOST` needs)

```bash
{ printf '01/1/GET_PLAY_STATUS:\r\n'; sleep 2; } | nc 192.168.1.50 10000
```

- `01/1/000:PLAY_STATUS:0:0:...` — yes. Use this address for `KALEIDESCAPE_PLAYER_HOST`.
- `01/1/010:Invalid request:/68` — no. This is a movie server.

**Does it hold the library?** (this is what `KALEIDESCAPE_SERVER_HOST` needs)

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.1.50/movies
```

- `200` — yes. Use this address for `KALEIDESCAPE_SERVER_HOST`.
- `404` — no. This device doesn't hold the library.

If **one address answers `200` and `PLAY_STATUS`**, you have an all-in-one system:
use it for `KALEIDESCAPE_PLAYER_HOST` and leave `KALEIDESCAPE_SERVER_HOST` blank.

### How you'll know if it's wrong

LivePoster detects this at startup and tells you in the log:

```
⚠️  192.168.1.51 rejected GET_PLAY_STATUS — it reports itself as "Terra Prime Movie Server (HDD)".
    This device cannot report playback, so "Now Playing" will never appear.
    Set KALEIDESCAPE_PLAYER_HOST to your PLAYER, and KALEIDESCAPE_SERVER_HOST to this
    address (192.168.1.51) so the movie library still loads from it.
    On an all-in-one system such as a Strato V, leave KALEIDESCAPE_SERVER_HOST blank.
```

You can also check `http://your-server:3000/api/debug/kaleidescape`, which reports
the detected `deviceType`, whether playback is supported, and both addresses in use.

### Notes

- No password or authentication is needed — Kaleidescape's control protocol is
  open on the local network.
- The control protocol must be enabled on the player. It is on by default on
  current firmware.
- LivePoster only ever *reads* state. It never sends playback commands.

---

## 5. Jellyfin and Plex

Both are optional. Configure whichever you use; LivePoster merges every
configured library into one slideshow.

### Jellyfin

1. Sign in to Jellyfin as an administrator
2. **Dashboard → API Keys → +**
3. Name it `LivePoster` and save
4. Copy the key

```bash
JELLYFIN_URL=http://192.168.1.61:8096
JELLYFIN_API_KEY=your_key_here
```

Include the port, and no trailing slash.

> A Jellyfin API key grants broad access to that server. Keep it out of anything
> you publish, and see the Docker secrets section of [DOCKER.md](DOCKER.md) for
> how to supply it from a file rather than an environment variable.

### Plex

1. Follow Plex's guide to find your token:
   <https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/>

```bash
PLEX_URL=http://192.168.1.60:32400
PLEX_TOKEN=your_token_here
```

### Nvidia Shield and other clients

There's no separate integration. A Shield running the Plex or Jellyfin app is
detected through that server.

---

## 6. Running it

### Docker Compose

```bash
cp .env.example .env    # then edit .env with your values
docker-compose up -d
```

### Unraid

See [UNRAID-QUICKSTART.md](UNRAID-QUICKSTART.md). Map `/app/.cache` to persistent
storage — that's where the metadata cache and your saved settings live, and it's
what makes them survive container updates.

### Node.js

```bash
npm install
cp .env.example .env    # then edit .env
npm start
```

Open <http://localhost:3000>.

---

## 7. First run

The first startup builds a metadata cache and is much slower than later ones.
LivePoster enriches every title against TMDb in batches of 5, showing progress on
the loading screen. Expect a few minutes for a library of several hundred titles,
depending on your network and how many lookups TMDb needs per title.

That result is cached in `.cache/movies.json`, so subsequent startups take
seconds. Only newly added titles get looked up after that.

Once loaded:

- **`http://your-server:3000`** — the poster display. Point your wall screen here.
- **`http://your-server:3000/manage.html`** — metadata manager. Review matches,
  correct wrong ones by searching TMDb, and exclude individual titles from the
  slideshow.
- **Settings** — the ⚙️ button inside the manager. Everything configurable by
  environment variable can also be set here, and is saved to
  `.cache/settings.json`.

> **Saved settings take precedence over environment variables.** If you change a
> value in your `.env` or Unraid template and nothing happens, it's because a
> saved setting is overriding it. Change it in the Settings UI instead, or delete
> `.cache/settings.json` to fall back to the environment.

### Security

LivePoster has **no authentication of any kind**. Anyone who can reach it can view
the settings page. It's built for a trusted home network — don't port-forward it
or expose it to the internet.

---

## 8. Troubleshooting

### "Setup Required" won't go away

Both TMDb credentials must be set — the API key *and* the read token — plus at
least one media system. The screen lists what's missing.

### The slideshow works, but "Now Playing" never appears

Your `KALEIDESCAPE_PLAYER_HOST` is almost certainly pointing at a movie server rather
than a player. See [section 4](#4-kaleidescape-which-address-goes-where), and
check the startup log for the warning.

### Kaleidescape won't connect

- Confirm the address: `nc -vz 192.168.1.50 10000`
- Check that the container can reach the player's subnet — a Docker bridge
  network on a different VLAN is a common cause.
- LivePoster retries every poll interval, so a player that's simply powered off
  will connect on its own once it's back.

### No posters, or many titles missing

- Check the log for `TMDb enrichment complete: X/Y movies matched`. A low match
  rate usually means unusual title formatting in your library.
- Use the metadata manager to fix individual titles — search TMDb and pick the
  right match.
- Discs whose titles TMDb doesn't recognise keep their library metadata but have
  no poster.

### A movie never shows in the slideshow

- It may be excluded — check its toggle in the metadata manager.
- It may be filtered by rating. Settings → Content Filters controls which ratings
  appear. TV ratings map onto the closest MPAA bucket (`TV-MA` counts as `R`,
  `TV-14` as `PG-13`, `TV-PG` as `PG`), and unrated titles that carry an advisory
  equivalent (`NR-R`) are filtered as that equivalent.

### Settings changes don't take effect

Poll intervals, API keys, and server addresses are read at startup. Restart after
changing them. Display scale and content filters apply immediately.

### Starting over

Delete `.cache/movies.json` to force a full re-scan, or use **Clear Cache &
Restart** in Settings. Delete `.cache/settings.json` to discard saved settings and
fall back to environment variables.
