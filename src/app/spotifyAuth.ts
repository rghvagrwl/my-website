const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com";
const TOKEN_KEY = "spotify-auth-tokens-v1";
const STATE_KEY = "spotify-auth-state-v1";
const VERIFIER_KEY = "spotify-auth-verifier-v1";
const STATE_FALLBACK_KEY = "spotify-auth-state-fallback-v1";
const VERIFIER_FALLBACK_KEY = "spotify-auth-verifier-fallback-v1";

const EXPIRY_SAFETY_MS = 30_000;

export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
];

type StoredSpotifyTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

function getClientId(): string {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
  return clientId?.trim() ?? "";
}

function getRedirectUri(): string {
  const configured = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined;
  const runtimeDefault = `${window.location.origin}/music`;
  if (!configured || configured.trim().length === 0) return runtimeDefault;

  const value = configured.trim();
  try {
    const configuredUrl = new URL(value);
    const currentHost = window.location.hostname;
    const configuredHost = configuredUrl.hostname;
    const isLocalHost = (host: string) => host === "localhost" || host === "127.0.0.1";

    // Keep local development stable even when the dev server port changes.
    if (isLocalHost(currentHost) && isLocalHost(configuredHost)) {
      const nextPath = configuredUrl.pathname && configuredUrl.pathname !== "/"
        ? configuredUrl.pathname
        : "/music";
      return `${window.location.origin}${nextPath}`;
    }
    return configuredUrl.toString();
  } catch {
    return runtimeDefault;
  }
}

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let str = "";
  bytes.forEach((b) => {
    str += String.fromCharCode(b);
  });
  return window.btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function saveTokens(tokens: StoredSpotifyTokens): void {
  window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function loadTokens(): StoredSpotifyTokens | null {
  const raw = window.localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSpotifyTokens;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearAuthUrlParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function createTokenExpiry(expiresInSeconds: number): number {
  return Date.now() + expiresInSeconds * 1000 - EXPIRY_SAFETY_MS;
}

type TokenApiResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
};

async function requestToken(params: URLSearchParams): Promise<TokenApiResponse> {
  const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Spotify token request failed (${response.status}): ${text}`);
  }
  return (await response.json()) as TokenApiResponse;
}

export function hasSpotifyConfig(): boolean {
  return getClientId().length > 0;
}

export function clearSpotifyAuth(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(STATE_FALLBACK_KEY);
  window.localStorage.removeItem(VERIFIER_FALLBACK_KEY);
  window.sessionStorage.removeItem(STATE_KEY);
  window.sessionStorage.removeItem(VERIFIER_KEY);
}

export async function startSpotifyLogin(): Promise<void> {
  const clientId = getClientId();
  if (!clientId) throw new Error("Missing VITE_SPOTIFY_CLIENT_ID");

  const redirectUri = getRedirectUri();
  const state = randomString(24);
  const verifier = randomString(64);
  const challenge = await sha256Base64Url(verifier);

  window.sessionStorage.setItem(STATE_KEY, state);
  window.sessionStorage.setItem(VERIFIER_KEY, verifier);
  window.localStorage.setItem(STATE_FALLBACK_KEY, state);
  window.localStorage.setItem(VERIFIER_FALLBACK_KEY, verifier);

  const authUrl = new URL(`${SPOTIFY_ACCOUNTS_BASE}/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", SPOTIFY_SCOPES.join(" "));
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", challenge);

  // Force redirect in the same tab/window for auth.
  window.location.replace(authUrl.toString());
}

export async function completeSpotifyAuthFromUrl(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (!code && !error) return false;
  if (error) {
    clearAuthUrlParams();
    throw new Error(`Spotify auth failed: ${error}`);
  }

  const expectedState =
    window.sessionStorage.getItem(STATE_KEY) ??
    window.localStorage.getItem(STATE_FALLBACK_KEY);
  const verifier =
    window.sessionStorage.getItem(VERIFIER_KEY) ??
    window.localStorage.getItem(VERIFIER_FALLBACK_KEY);
  if (!state || !expectedState || state !== expectedState || !verifier) {
    clearAuthUrlParams();
    throw new Error("Spotify auth state mismatch. Click Connect Spotify and try again.");
  }

  const clientId = getClientId();
  if (!clientId) {
    clearAuthUrlParams();
    throw new Error("Missing VITE_SPOTIFY_CLIENT_ID");
  }

  const redirectUri = getRedirectUri();
  const result = await requestToken(
    new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    })
  );

  if (!result.refresh_token) {
    throw new Error("Spotify did not return a refresh token");
  }

  saveTokens({
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: createTokenExpiry(result.expires_in),
  });

  window.sessionStorage.removeItem(STATE_KEY);
  window.sessionStorage.removeItem(VERIFIER_KEY);
  window.localStorage.removeItem(STATE_FALLBACK_KEY);
  window.localStorage.removeItem(VERIFIER_FALLBACK_KEY);
  clearAuthUrlParams();
  return true;
}

export async function getValidSpotifyAccessToken(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;

  if (Date.now() < tokens.expiresAt) return tokens.accessToken;

  const clientId = getClientId();
  if (!clientId) return null;

  const refreshed = await requestToken(
    new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    })
  );

  const nextRefreshToken = refreshed.refresh_token ?? tokens.refreshToken;
  const next = {
    accessToken: refreshed.access_token,
    refreshToken: nextRefreshToken,
    expiresAt: createTokenExpiry(refreshed.expires_in),
  };
  saveTokens(next);
  return next.accessToken;
}
