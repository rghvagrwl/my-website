
  # Untitled

  This is a code bundle for Untitled. The original project is available at https://www.figma.com/design/JkInY1ppQBhUjnkfyUkRm4/Untitled.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  # my-website
# my-website
# my-website

## Spotify SDK (Music page)

To use `/music`, add a `.env.local` file:

```bash
VITE_SPOTIFY_CLIENT_ID=your_spotify_app_client_id
VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/music
VITE_SPOTIFY_SYNC_PLAYLIST_ID=your_playlist_id_or_spotify_playlist_url
VITE_SPOTIFY_SYNC_PLAYLIST_IDS=playlist_id_or_url_1,playlist_id_or_url_2
```

In your Spotify app dashboard, add the same redirect URI exactly.

If you already connected Spotify before adding playlist sync, disconnect and reconnect once so the new playlist scopes are granted.

When `VITE_SPOTIFY_SYNC_PLAYLIST_IDS` is set, tracks are merged in order, duplicate songs are removed, and artists are distributed so the same artist is less likely to appear back-to-back.
