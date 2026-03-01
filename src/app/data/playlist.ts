import csvRaw from "./playlist.csv?raw";

export interface PlaylistTrack {
  title: string;
  artist: string;
  albumCover: string;
  slug: string;
  songLink: string;
  duration: number;
}

const DEFAULT_DURATION_SECONDS = 210;

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (ch === '"') {
      if (inQuotes && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim().length > 0)) rows.push(row);
  }

  return rows;
}

function colIndex(headers: string[], name: string): number {
  return headers.findIndex(
    (h) => h.trim().toLowerCase() === name.trim().toLowerCase()
  );
}

function buildPlaylist(csvText: string): PlaylistTrack[] {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0];
  const titleIdx = colIndex(headers, "Title");
  const artistIdx = colIndex(headers, "Artist");
  const coverIdx = colIndex(headers, "Album Cover URL");
  const slugIdx = colIndex(headers, "Slug");
  const linkIdx = colIndex(headers, "Song Link");

  return rows
    .slice(1)
    .map((row) => {
      const title = row[titleIdx]?.trim() ?? "";
      const artist = row[artistIdx]?.trim() ?? "";
      const albumCover = row[coverIdx]?.trim() ?? "";
      const slug = row[slugIdx]?.trim() ?? "";
      const songLink = row[linkIdx]?.trim() ?? "";

      if (!title || !artist || !albumCover || !songLink) return null;

      return {
        title,
        artist,
        albumCover,
        slug,
        songLink,
        duration: DEFAULT_DURATION_SECONDS,
      } satisfies PlaylistTrack;
    })
    .filter((track): track is PlaylistTrack => track !== null);
}

function shuffleTracks<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const PLAYLIST: PlaylistTrack[] = buildPlaylist(csvRaw);
export const SESSION_PLAYLIST: PlaylistTrack[] = shuffleTracks(PLAYLIST);
