import { getValidSpotifyAccessToken } from "../spotifyAuth";
import type { PlaylistTrack } from "./playlist";

const TRACKS_PAGE_LIMIT = 100;
const DEFAULT_DURATION_SECONDS = 210;

type SpotifyTrack = {
  id?: string | null;
  name?: string | null;
  duration_ms?: number | null;
  external_urls?: {
    spotify?: string | null;
  } | null;
  artists?: Array<{
    name?: string | null;
  }> | null;
  album?: {
    images?: Array<{
      url?: string | null;
    }> | null;
  } | null;
};

type SpotifyPlaylistTracksResponse = {
  items?: Array<{
    track?: SpotifyTrack | null;
  }> | null;
  next?: string | null;
};

function extractTrackIdFromSongLink(songLink: string): string | null {
  const match = songLink.match(/track\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? null;
}

function normalizeText(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildTrackFingerprint(track: PlaylistTrack): string {
  const primaryArtist = track.artist.split(",")[0] ?? track.artist;
  return `${normalizeText(track.title)}|${normalizeText(primaryArtist)}`;
}

function parsePlaylistId(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return null;

  const uriMatch = value.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch?.[1]) return uriMatch[1];

  const urlMatch = value.match(/playlist\/([a-zA-Z0-9]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  const idMatch = value.match(/^([a-zA-Z0-9]+)$/);
  if (idMatch?.[1]) return idMatch[1];

  return null;
}

function createSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapTrack(track: SpotifyTrack): PlaylistTrack | null {
  const title = track.name?.trim() ?? "";
  const artist = (track.artists ?? [])
    .map((item) => item.name?.trim() ?? "")
    .filter((name) => name.length > 0)
    .join(", ");
  const albumCover = track.album?.images?.[0]?.url?.trim() ?? "";
  const trackId = track.id?.trim() ?? "";
  const songLink = track.external_urls?.spotify?.trim() ?? "";
  const durationMs = Number(track.duration_ms ?? 0);
  const duration = Number.isFinite(durationMs) && durationMs > 0
    ? Math.max(1, Math.round(durationMs / 1000))
    : DEFAULT_DURATION_SECONDS;

  if (!title || !artist || !albumCover || !songLink) return null;

  const fallbackSlug = createSlug(`${title}-${artist}`);
  return {
    title,
    artist,
    albumCover,
    slug: trackId || fallbackSlug || "track",
    songLink,
    duration,
  };
}

export function getConfiguredSpotifyPlaylistId(): string | null {
  const configured = import.meta.env.VITE_SPOTIFY_SYNC_PLAYLIST_ID as string | undefined;
  if (!configured) return null;
  return parsePlaylistId(configured);
}

export function getConfiguredSpotifyPlaylistIds(): string[] {
  const configuredSingle = import.meta.env.VITE_SPOTIFY_SYNC_PLAYLIST_ID as
    | string
    | undefined;
  const configuredList = import.meta.env.VITE_SPOTIFY_SYNC_PLAYLIST_IDS as
    | string
    | undefined;

  const candidates = [configuredSingle, configuredList]
    .flatMap((value) => (value ? value.split(/[\n,]+/) : []))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const normalized = candidates
    .map((value) => parsePlaylistId(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalized));
}

async function fetchSpotifyPlaylistTracksWithToken(
  token: string,
  playlistId: string
): Promise<PlaylistTrack[] | null> {
  const normalizedPlaylistId = parsePlaylistId(playlistId);
  if (!normalizedPlaylistId) {
    throw new Error("Invalid Spotify playlist ID. Set VITE_SPOTIFY_SYNC_PLAYLIST_ID.");
  }

  const tracks: PlaylistTrack[] = [];
  let nextUrl: string | null =
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(normalizedPlaylistId)}` +
    `/tracks?market=from_token&limit=${TRACKS_PAGE_LIMIT}`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) return null;
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Spotify playlist request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as SpotifyPlaylistTracksResponse;
    (payload.items ?? []).forEach((item) => {
      const mapped = item.track ? mapTrack(item.track) : null;
      if (mapped) tracks.push(mapped);
    });
    nextUrl = payload.next ?? null;
  }

  return tracks;
}

export async function fetchSpotifyPlaylistsTracks(
  playlistIds: string[]
): Promise<PlaylistTrack[] | null> {
  if (playlistIds.length === 0) return [];

  const token = await getValidSpotifyAccessToken();
  if (!token) return null;

  const mergedTracks: PlaylistTrack[] = [];
  const seenTrackKeys = new Set<string>();
  const seenFingerprints = new Set<string>();

  for (const playlistId of playlistIds) {
    const playlistTracks = await fetchSpotifyPlaylistTracksWithToken(token, playlistId);
    if (!playlistTracks) return null;

    playlistTracks.forEach((track) => {
      const trackId = extractTrackIdFromSongLink(track.songLink);
      const dedupeKey = trackId ?? track.songLink;
      const fingerprint = buildTrackFingerprint(track);
      if (seenTrackKeys.has(dedupeKey) || seenFingerprints.has(fingerprint)) return;
      seenTrackKeys.add(dedupeKey);
      seenFingerprints.add(fingerprint);
      mergedTracks.push(track);
    });
  }

  return mergedTracks;
}

export async function fetchSpotifyPlaylistTracks(
  playlistId: string
): Promise<PlaylistTrack[] | null> {
  const tracks = await fetchSpotifyPlaylistsTracks([playlistId]);
  return tracks;
}
