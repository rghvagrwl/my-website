import DynamicIsland from "./components/DynamicIsland";
import NotesPage from "./components/NotesPage";

function normalizePathname(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function resetSpotifyAuthStorage() {
  localStorage.removeItem("spotify-auth-tokens-v1");
  localStorage.removeItem("spotify-auth-state-fallback-v1");
  localStorage.removeItem("spotify-auth-verifier-fallback-v1");
  sessionStorage.removeItem("spotify-auth-state-v1");
  sessionStorage.removeItem("spotify-auth-verifier-v1");
}

export default function App() {
  const pathname = normalizePathname(window.location.pathname);

  if (pathname === "/writing") {
    window.location.href = "/notes";
    return null;
  }

  if (pathname === "/reset-spotify-auth") {
    resetSpotifyAuthStorage();
    window.location.href = "/new-music";
    return null;
  }

  if (pathname === "/notes") {
    return <NotesPage />;
  }

  return <DynamicIsland />;
}
