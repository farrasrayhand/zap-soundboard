# Zap Web

Web version of [Zap](https://gitlab.com/rmnvgr/zap) soundboard for streamers and content creators. Runs entirely in the browser — no server-side processing needed.

## Usage

1. Click **Add Sound** to upload audio files (MP3, WAV, OGG, FLAC, M4A, OPUS).
2. Files are automatically converted to WAV for maximum browser compatibility.
3. Click a sound card to play it. Click again to pause (if enabled).
4. Use **hotkeys** to trigger sounds without clicking.
5. Organize sounds into **groups** and **collections**.

Audio is decoded and cached in IndexedDB for instant playback on subsequent clicks.

## Running Locally

Serve the directory with any HTTP server (ES modules require HTTP, not `file://`):

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# PHP
php -S localhost:8080

# Deno
deno serve --port 8080 .
```

Then open `http://localhost:8080` in your browser.

## Hosting on Easypanel

1. Create a new **Static Site** service in Easypanel.
2. Set the **Build Command** to empty (no build step needed).
3. Set the **Publish Directory** to `/` (or the path containing these files).
4. Deploy. Easypanel will serve `index.html` automatically.

The app is fully static — no backend, no database setup required.

## Other Hosting Options

Any static file server works:

- **GitHub Pages** / **GitLab Pages** — push to `gh-pages` branch
- **Vercel** — import repo, settings: Framework = `Other`, Output = `./`
- **Netlify** — drag & drop the folder, or connect Git repo
- **Cloudflare Pages** — connect repo, build command = empty, build output = `<root>`
- **Nginx / Apache** — just point document root to this directory
- **Docker** — use `nginx:alpine`, copy files to `/usr/share/nginx/html`

No special configuration needed.

## Browser Support

- Chrome, Firefox, Edge, Safari 14+ (modern ES modules + IndexedDB)
- Audio formats supported: WAV, MP3, OGG, FLAC, M4A, OPUS

## Structure

```
├── index.html          Entry point
├── css/                Stylesheets
├── js/                 JavaScript modules
│   ├── app.js          Main app
│   ├── player.js       Audio engine with PCM caching
│   ├── db.js           IndexedDB wrapper
│   ├── models/         Data models (Zap, Collection, Group, Color)
│   ├── services/       Business logic
│   └── ui/             UI components
├── lib/                Third-party libraries (fflate)
└── sounds/             Default sound effects
```
