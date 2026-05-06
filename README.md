# Zap Web

Web version of Zap soundboard.

## Cara Menjalankan

Jalankan HTTP server dari direktori ini (ES modules tidak bisa lewat `file://`):

```bash
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080` di browser.

Atau dengan Node.js:

```bash
npx serve .
```

## Struktur

- `index.html` — Entry point
- `js/` — JavaScript modules
- `css/` — Stylesheets
- `lib/` — Third-party libraries (fflate)
- `sounds/` — Default sound effects
