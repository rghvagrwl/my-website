import { useEffect, useState, type CSSProperties } from "react";
import DynamicIsland from "./components/DynamicIsland";
import MusicCanvas from "./components/MusicCanvas";
import { PLAYLIST } from "./data/playlist";

type View = "home" | "music" | "works" | "writing";

const BASE_FONT =
  'Inter, "SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const PROFILE_PICTURE_PATH = "/raghav-profile.png";
let hasPlayedAboutIntro = false;

function getViewFromPath(pathname: string): View {
  if (pathname === "/music") return "music";
  if (pathname === "/new-music") return "music";
  if (pathname === "/works") return "works";
  if (pathname === "/writing") return "writing";
  return "home";
}

function getPathFromView(view: View): string {
  if (view === "music") return "/music";
  if (view === "works") return "/works";
  if (view === "writing") return "/writing";
  return "/";
}

function getDocumentTitle(view: View): string {
  if (view === "music") return "Music – Raghav Agarwal";
  if (view === "works") return "Works – Raghav Agarwal";
  if (view === "writing") return "Writing – Raghav Agarwal";
  return "Raghav Agarwal";
}

function glassButtonStyle(hovered: boolean, pressed: boolean): CSSProperties {
  return {
    backgroundColor: pressed
      ? "rgba(26,26,26,0.42)"
      : hovered
        ? "rgba(26,26,26,0.38)"
        : "rgba(26,26,26,0.34)",
    backdropFilter: "blur(24px) saturate(1.8)",
    WebkitBackdropFilter: "blur(24px) saturate(1.8)",
    border: "1px solid rgba(255,255,255,0.24)",
    boxShadow:
      "0 10px 26px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.22)",
  };
}

const MENU_ITEMS: Array<{
  id: View;
  label: string;
  count?: number;
}> = [
  {
    id: "home",
    label: "About",
  },
  {
    id: "music",
    label: "Music",
    count: PLAYLIST.length,
  },
  {
    id: "works",
    label: "Works",
    count: 0,
  },
  {
    id: "writing",
    label: "Writing",
    count: 0,
  },
];

function HomeContent() {
  const [shouldAnimate] = useState(() => !hasPlayedAboutIntro);
  const [isVisible, setIsVisible] = useState(!shouldAnimate);

  useEffect(() => {
    if (!shouldAnimate) return;

    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });
    hasPlayedAboutIntro = true;

    return () => window.cancelAnimationFrame(frame);
  }, [shouldAnimate]);

  const getRevealStyle = (index: number): CSSProperties => {
    const isProfile = index === 0;
    const textDuration = 920;
    const textInitialDelay = 120;
    const textStep = 150;
    const delay = isProfile ? 0 : textInitialDelay + (index - 1) * textStep;
    const duration = isProfile ? 2000 : textDuration;
    const easing = "cubic-bezier(0.22,1,0.36,1)";
    const startBlur = isProfile ? 14 : 8;
    const startY = isProfile ? 14 : 10;
    const startScale = isProfile ? 0.965 : 0.985;

    return {
      opacity: isVisible ? 1 : 0,
      filter: isVisible ? "blur(0px)" : `blur(${startBlur}px)`,
      transform: isVisible
        ? "translateY(0px) scale(1)"
        : `translateY(${startY}px) scale(${startScale})`,
      transition: shouldAnimate
        ? [
            `opacity ${duration}ms ${easing} ${delay}ms`,
            `filter ${duration}ms ${easing} ${delay}ms`,
            `transform ${duration}ms ${easing} ${delay}ms`,
          ].join(", ")
        : undefined,
      willChange: shouldAnimate ? "opacity, filter, transform" : undefined,
    };
  };

  return (
    <div className="absolute inset-0 flex items-end justify-center px-6 pb-[96px] pt-[72px] md:items-center md:pb-[120px]">
      <article
        className="w-full max-w-[470px] text-[14px] leading-[1.48]"
        style={{ color: "rgba(30,30,30,0.8)" }}
      >
        <img
          src={PROFILE_PICTURE_PATH}
          alt="Raghav Agarwal profile picture"
          width={32}
          height={32}
          className="mb-5 h-[32px] w-[32px] rounded-full object-cover"
          style={getRevealStyle(0)}
        />
        <p className="mb-5" style={getRevealStyle(1)}>
          <span style={{ color: "#1E1E1E" }}>Raghav Agarwal</span> is an
          18-year-old product designer from Calgary, Canada, building
          thoughtful digital products. His work focuses on intuitive and
          frictionless interfaces, with an emphasis on clarity so products feel
          natural and obvious in use.
        </p>
        <p className="mb-5" style={getRevealStyle(2)}>
          Beyond product work, he&apos;s interested in how design shapes
          experiences, and how small details influence the way people feel and
          move through the world. He draws inspiration from films, photography,
          and everyday moments in the real world.
        </p>
        <p className="mb-5" style={getRevealStyle(3)}>
          Raghav is also in his first year at the University of Waterloo,
          studying Global Business and Digital Arts.
        </p>
        <p style={getRevealStyle(4)}>
          You can reach him via{" "}
          <a
            href="https://linkedin.com/in/rghv-agrwl"
            target="_blank"
            rel="noreferrer"
            style={{
              color: "#1E1E1E",
              textDecorationLine: "underline",
              textDecorationStyle: "dotted",
              textDecorationColor: "rgba(30,30,30,0.4)",
              textUnderlineOffset: "3px",
              textDecorationThickness: "1px",
              transition: "color 140ms ease, text-decoration-color 140ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#0059FF";
              e.currentTarget.style.textDecorationColor = "rgba(0,89,255,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#1E1E1E";
              e.currentTarget.style.textDecorationColor = "rgba(30,30,30,0.4)";
            }}
          >
            LinkedIn
          </a>
          ,{" "}
          <a
            href="https://x.com/raghaav"
            target="_blank"
            rel="noreferrer"
            style={{
              color: "#1E1E1E",
              textDecorationLine: "underline",
              textDecorationStyle: "dotted",
              textDecorationColor: "rgba(30,30,30,0.4)",
              textUnderlineOffset: "3px",
              textDecorationThickness: "1px",
              transition: "color 140ms ease, text-decoration-color 140ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#0059FF";
              e.currentTarget.style.textDecorationColor = "rgba(0,89,255,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#1E1E1E";
              e.currentTarget.style.textDecorationColor = "rgba(30,30,30,0.4)";
            }}
          >
            X
          </a>
          , or{" "}
          <a
            href="mailto:rghvagwl@gmail.com"
            style={{
              color: "#1E1E1E",
              textDecorationLine: "underline",
              textDecorationStyle: "dotted",
              textDecorationColor: "rgba(30,30,30,0.4)",
              textUnderlineOffset: "3px",
              textDecorationThickness: "1px",
              transition: "color 140ms ease, text-decoration-color 140ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#0059FF";
              e.currentTarget.style.textDecorationColor = "rgba(0,89,255,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#1E1E1E";
              e.currentTarget.style.textDecorationColor = "rgba(30,30,30,0.4)";
            }}
          >
            email
          </a>
          .
        </p>
      </article>
    </div>
  );
}

function MenuOverlay({
  onSelect,
  isOpen,
}: {
  onSelect: (view: View) => void;
  isOpen: boolean;
}) {
  return (
    <div
      className="absolute inset-0 z-30 overflow-hidden"
      style={{
        opacity: isOpen ? 1 : 0,
        transition: "opacity 260ms ease",
        willChange: "opacity",
        pointerEvents: isOpen ? "auto" : "none",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(255,255,255,0.6)",
          backdropFilter: "blur(44px) saturate(1.1)",
          WebkitBackdropFilter: "blur(44px) saturate(1.1)",
        }}
      />
      <div
        className="absolute left-0 top-0 h-full w-full px-8 pb-16 pt-28"
        style={{
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "translateY(0px)" : "translateY(12px)",
          transition: "opacity 220ms ease, transform 220ms ease",
        }}
      >
        <div className="flex h-full items-end">
          <div className="w-full space-y-10">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="group flex w-full cursor-pointer items-center text-left"
                onClick={() => onSelect(item.id)}
              >
                <span className="text-[64px] leading-[0.95] tracking-[-0.03em] text-[rgba(30,30,30,0.38)] transition-colors duration-200 group-hover:text-[rgba(30,30,30,0.62)]">
                  {item.label}
                  {typeof item.count === "number" && (
                    <sup className="ml-2 align-super text-[0.45em] text-[rgba(30,30,30,0.19)] transition-colors duration-200 group-hover:text-[rgba(30,30,30,0.31)]">
                      {item.count}
                    </sup>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <p className="text-[18px] tracking-[-0.01em] text-[rgba(30,30,30,0.55)]">
        {title} coming soon.
      </p>
    </div>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined" ? getViewFromPath(window.location.pathname) : "home"
  );
  const [menuHovered, setMenuHovered] = useState(false);
  const [menuPressed, setMenuPressed] = useState(false);
  const [musicSelectedTrackIndex, setMusicSelectedTrackIndex] = useState(0);
  const [musicTrackRequest, setMusicTrackRequest] = useState(0);
  const isMusicView = view === "music";
  const showDynamicIsland = isMusicView;
  const openMenu = () => setMenuOpen(true);
  const closeMenu = () => setMenuOpen(false);

  const navigateToView = (nextView: View) => {
    const nextPath = getPathFromView(nextView);
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setView(nextView);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => setView(getViewFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = getDocumentTitle(view);
  }, [view]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/new-music") return;

    const url = new URL(window.location.href);
    const hasAuthParams =
      url.searchParams.has("code") ||
      url.searchParams.has("state") ||
      url.searchParams.has("error");
    if (hasAuthParams) return;

    window.history.replaceState({}, "", `/music${url.search}${url.hash}`);
  }, []);

  return (
    <main
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: "#F7F7F7",
        color: "#1E1E1E",
        fontFamily: BASE_FONT,
        height: "100%",
      }}
    >
      <div
        className="absolute inset-0 transition-[filter,transform] duration-[500ms] ease-[cubic-bezier(0.22,0.9,0.24,1)]"
        style={{
          filter: menuOpen ? "blur(18px)" : undefined,
          transform: menuOpen ? "scale(1.01)" : undefined,
          pointerEvents: menuOpen ? "none" : "auto",
        }}
      >
        {isMusicView ? (
          <MusicCanvas
            disableTrackLinks
            onTrackSelect={(trackIndex) => {
              setMusicSelectedTrackIndex(trackIndex);
              setMusicTrackRequest((prev) => prev + 1);
            }}
          />
        ) : null}
        {view === "home" ? <HomeContent /> : null}
        {view === "works" ? <PlaceholderPage title="Works" /> : null}
        {view === "writing" ? <PlaceholderPage title="Writing" /> : null}
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          background: [
            "linear-gradient(to bottom, rgba(247,247,247,0.9) 0%, rgba(247,247,247,0) 8%)",
            "linear-gradient(to top, rgba(247,247,247,0.9) 0%, rgba(247,247,247,0) 8%)",
            "linear-gradient(to right, rgba(247,247,247,0.9) 0%, rgba(247,247,247,0) 6%)",
            "linear-gradient(to left, rgba(247,247,247,0.9) 0%, rgba(247,247,247,0) 6%)",
          ].join(", "),
        }}
      />
      <div
        className="fixed inset-0 z-[25] pointer-events-none transition-[filter,opacity,transform] duration-300"
        aria-hidden={!showDynamicIsland}
        style={{
          opacity: showDynamicIsland ? 1 : 0,
          transform: showDynamicIsland ? undefined : "translateY(24px)",
          visibility: showDynamicIsland ? "visible" : "hidden",
        }}
      >
        <DynamicIsland
          spotifyEnabled={isMusicView}
          selectedTrackIndex={musicSelectedTrackIndex}
          selectedTrackRequest={musicTrackRequest}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-[26] transition-opacity duration-[500ms] ease-[cubic-bezier(0.22,0.9,0.24,1)]"
        style={{
          opacity: menuOpen ? 1 : 0,
          backgroundColor: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      />

      <button
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        className="absolute right-6 top-6 z-[80] inline-flex cursor-pointer items-center justify-center rounded-lg p-3 transition-all duration-150 hover:scale-[1.03] active:scale-95"
        style={glassButtonStyle(menuHovered, menuPressed)}
        onMouseEnter={() => setMenuHovered(true)}
        onMouseLeave={() => {
          setMenuHovered(false);
          setMenuPressed(false);
        }}
        onMouseDown={() => setMenuPressed(true)}
        onMouseUp={() => setMenuPressed(false)}
        onClick={() => {
          if (menuOpen) {
            closeMenu();
          } else {
            openMenu();
          }
        }}
        type="button"
      >
        <span className="relative block h-[16px] w-[16px]" aria-hidden>
          <span
            className="absolute left-0 top-0 h-[1.5px] w-[16px] rounded-full bg-white transition-all duration-300 ease-[cubic-bezier(0.2,0.82,0.2,1)]"
            style={{
              transformOrigin: "50% 50%",
              transform: menuOpen
                ? "translateY(7px) rotate(45deg)"
                : "translateY(3.5px) rotate(0deg)",
              opacity: 0.92,
            }}
          />
          <span
            className="absolute left-0 top-0 h-[1.5px] w-[16px] rounded-full bg-white transition-all duration-300 ease-[cubic-bezier(0.2,0.82,0.2,1)]"
            style={{
              transformOrigin: "50% 50%",
              transform: menuOpen
                ? "translateY(7px) rotate(-45deg)"
                : "translateY(11.5px) rotate(0deg)",
              opacity: 0.92,
            }}
          />
        </span>
      </button>

      <MenuOverlay
        isOpen={menuOpen}
        onSelect={(nextView) => {
          navigateToView(nextView);
          closeMenu();
        }}
      />
    </main>
  );
}
