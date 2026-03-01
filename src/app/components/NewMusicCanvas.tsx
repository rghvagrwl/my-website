import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PLAYLIST } from "../data/playlist";
import {
  clearSpotifyAuth,
  completeSpotifyAuthFromUrl,
  getValidSpotifyAccessToken,
  hasSpotifyConfig,
  startSpotifyLogin,
} from "../spotifyAuth";

type PlaybackStatus =
  | "missing_config"
  | "disconnected"
  | "connecting"
  | "ready"
  | "error";

type SpotifyPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  addListener: (event: string, cb: (payload: any) => void) => void;
  removeListener: (event: string) => void;
};

declare global {
  interface Window {
    Spotify?: {
      Player: new (config: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

function extractTrackId(link: string): string | null {
  const match = link.match(/track\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? null;
}

async function loadSpotifySdk(): Promise<NonNullable<Window["Spotify"]>> {
  if (window.Spotify) return window.Spotify;

  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("spotify-player-sdk");
    if (existing) {
      const previous = window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady = () => {
        previous?.();
        resolve();
      };
      return;
    }

    const script = document.createElement("script");
    script.id = "spotify-player-sdk";
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Spotify SDK"));

    const previous = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      previous?.();
      resolve();
    };

    document.body.appendChild(script);
  });

  if (!window.Spotify) {
    throw new Error("Spotify SDK did not initialize");
  }
  return window.Spotify;
}

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function NewMusicCanvas() {
  const [status, setStatus] = useState<PlaybackStatus>(() =>
    hasSpotifyConfig() ? "disconnected" : "missing_config"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const playerRef = useRef<SpotifyPlayer | null>(null);
  const bootedRef = useRef(false);
  const track = PLAYLIST[trackIndex];

  const progress = useMemo(() => {
    if (durationMs <= 0) return 0;
    return Math.max(0, Math.min(1, positionMs / durationMs));
  }, [durationMs, positionMs]);

  const callSpotifyApi = useCallback(
    async (path: string, init: RequestInit) => {
      const token = await getValidSpotifyAccessToken();
      if (!token) throw new Error("Spotify token unavailable");

      const response = await fetch(`https://api.spotify.com/v1${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init.headers ?? {}),
        },
      });

      if (!response.ok && response.status !== 204) {
        const text = await response.text();
        throw new Error(`Spotify API ${response.status}: ${text}`);
      }
    },
    []
  );

  const playTrackAtIndex = useCallback(
    async (nextIndex: number) => {
      if (!deviceId) return;
      const wrapped = (nextIndex + PLAYLIST.length) % PLAYLIST.length;
      const nextTrack = PLAYLIST[wrapped];
      const trackId = extractTrackId(nextTrack.songLink);
      if (!trackId) return;

      await callSpotifyApi(`/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        body: JSON.stringify({
          uris: [`spotify:track:${trackId}`],
        }),
      });
      setTrackIndex(wrapped);
      setIsPlaying(true);
    },
    [callSpotifyApi, deviceId]
  );

  const connectPlayer = useCallback(async () => {
    if (!hasSpotifyConfig()) {
      setStatus("missing_config");
      setErrorMessage("Missing VITE_SPOTIFY_CLIENT_ID");
      return;
    }

    try {
      setStatus("connecting");
      const sdk = await loadSpotifySdk();
      const player = new sdk.Player({
        name: "Raghav New Music Player",
        getOAuthToken: async (cb) => {
          const token = await getValidSpotifyAccessToken();
          cb(token ?? "");
        },
        volume: 0.7,
      });

      player.addListener("ready", async ({ device_id }: { device_id: string }) => {
        setDeviceId(device_id);
        setStatus("ready");
        setErrorMessage(null);
        try {
          await callSpotifyApi("/me/player", {
            method: "PUT",
            body: JSON.stringify({ device_ids: [device_id], play: false }),
          });
        } catch (error) {
          setErrorMessage((error as Error).message);
        }
      });

      player.addListener("authentication_error", ({ message }: { message: string }) => {
        setStatus("error");
        setErrorMessage(message);
      });
      player.addListener("account_error", ({ message }: { message: string }) => {
        setStatus("error");
        setErrorMessage(message);
      });
      player.addListener("playback_error", ({ message }: { message: string }) => {
        setStatus("error");
        setErrorMessage(message);
      });
      player.addListener("player_state_changed", (state: any) => {
        if (!state) return;
        setIsPlaying(!state.paused);
        setPositionMs(state.position ?? 0);
        setDurationMs(state.duration ?? 0);

        const uri: string | undefined = state.track_window?.current_track?.uri;
        if (!uri) return;
        const uriTrackId = uri.split(":")[2];
        const foundIndex = PLAYLIST.findIndex(
          (item) => extractTrackId(item.songLink) === uriTrackId
        );
        if (foundIndex >= 0) {
          setTrackIndex(foundIndex);
        }
      });

      const connected = await player.connect();
      if (!connected) {
        throw new Error("Spotify player failed to connect");
      }
      playerRef.current = player;
    } catch (error) {
      setStatus("error");
      setErrorMessage((error as Error).message);
    }
  }, [callSpotifyApi]);

  useEffect(() => {
    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    if (!hasSpotifyConfig()) {
      setStatus("missing_config");
      return;
    }

    (async () => {
      try {
        await completeSpotifyAuthFromUrl();
      } catch (error) {
        setStatus("error");
        setErrorMessage((error as Error).message);
        return;
      }
      const token = await getValidSpotifyAccessToken();
      if (!token) return;
      await connectPlayer();
    })();
  }, [connectPlayer]);

  useEffect(() => {
    if (!isPlaying || durationMs <= 0) return;
    const id = window.setInterval(() => {
      setPositionMs((prev) => Math.min(durationMs, prev + 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [durationMs, isPlaying]);

  return (
    <div className="absolute inset-0 overflow-y-auto px-6 pb-24 pt-24 md:px-8">
      <div className="mx-auto w-full max-w-[760px] rounded-3xl border border-[rgba(30,30,30,0.1)] bg-[rgba(255,255,255,0.78)] p-6 backdrop-blur-xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[20px] font-medium tracking-[-0.02em] text-[rgba(30,30,30,0.92)]">
              New Music
            </p>
            <p className="text-[12px] text-[rgba(30,30,30,0.58)]">
              Spotify SDK playback (requires Spotify Premium).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status !== "ready" ? (
              <button
                type="button"
                className="rounded-full bg-[#1DB954] px-4 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                onClick={() => {
                  if (!hasSpotifyConfig()) {
                    setStatus("missing_config");
                    setErrorMessage(
                      "Add VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_REDIRECT_URI in .env.local"
                    );
                    return;
                  }
                  void startSpotifyLogin();
                }}
              >
                Connect Spotify
              </button>
            ) : (
              <button
                type="button"
                className="rounded-full bg-[rgba(30,30,30,0.9)] px-4 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                onClick={() => {
                  clearSpotifyAuth();
                  playerRef.current?.disconnect();
                  playerRef.current = null;
                  setDeviceId(null);
                  setIsPlaying(false);
                  setStatus("disconnected");
                }}
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-[rgba(30,30,30,0.12)] bg-white/80 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="max-w-[70%] truncate text-[14px] font-medium text-[rgba(30,30,30,0.94)]">
              {track.title}
            </p>
            <p className="text-[11px] text-[rgba(30,30,30,0.56)]">
              {formatMs(positionMs)} / {formatMs(durationMs || track.duration * 1000)}
            </p>
          </div>
          <p className="mb-3 text-[12px] text-[rgba(30,30,30,0.58)]">{track.artist}</p>
          <div className="mb-4 h-[6px] rounded-full bg-[rgba(30,30,30,0.12)]">
            <div
              className="h-full rounded-full bg-[rgba(30,30,30,0.58)] transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-[rgba(30,30,30,0.18)] px-3 py-1.5 text-[12px] text-[rgba(30,30,30,0.86)]"
              onClick={() => {
                void playTrackAtIndex(trackIndex - 1);
              }}
              disabled={status !== "ready"}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded-full border border-[rgba(30,30,30,0.18)] px-3 py-1.5 text-[12px] text-[rgba(30,30,30,0.86)]"
              onClick={() => {
                const player = playerRef.current;
                if (!player || status !== "ready") return;
                void (isPlaying ? player.pause() : player.resume());
                setIsPlaying((prev) => !prev);
              }}
              disabled={status !== "ready"}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="rounded-full border border-[rgba(30,30,30,0.18)] px-3 py-1.5 text-[12px] text-[rgba(30,30,30,0.86)]"
              onClick={() => {
                void playTrackAtIndex(trackIndex + 1);
              }}
              disabled={status !== "ready"}
            >
              Next
            </button>
            <span className="ml-auto text-[11px] text-[rgba(30,30,30,0.52)]">
              Status: {status}
            </span>
          </div>
          {errorMessage ? (
            <p className="mt-3 text-[11px] text-[rgba(175,0,0,0.8)]">{errorMessage}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          {PLAYLIST.slice(0, 28).map((item, index) => (
            <button
              key={item.slug || item.songLink}
              type="button"
              className="flex items-center gap-3 rounded-xl border border-[rgba(30,30,30,0.09)] bg-white/70 p-2 text-left transition-colors hover:bg-white"
              onClick={() => {
                void playTrackAtIndex(index);
              }}
            >
              <img
                src={item.albumCover}
                alt={item.title}
                width={36}
                height={36}
                className="h-[36px] w-[36px] rounded-md object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-[13px] text-[rgba(30,30,30,0.92)]">{item.title}</p>
                <p className="truncate text-[11px] text-[rgba(30,30,30,0.56)]">{item.artist}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
