import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import svgPaths from "../../imports/svg-m4lwl8pe3p";
import svgPathsPlaying from "../../imports/svg-umafma3ph";
import grainGif from "../../../Grain (1).gif";
import { SESSION_PLAYLIST as PLAYLIST } from "../data/playlist";
import {
  completeSpotifyAuthFromUrl,
  getValidSpotifyAccessToken,
  hasSpotifyConfig,
  startSpotifyLogin,
} from "../spotifyAuth";

const SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 1,
} as const;
const INTRO_DELAY_MS = 1000;
const INTRO_SHIMMER_START_OFFSET_MS = 1400;
const INTRO_SHIMMER_DURATION_MS = 1250;
const SPOTIFY_PREMIUM_REQUIRED_ERROR = "Spotify premium required";
const SPOTIFY_PREMIUM_REQUIRED_ALERT =
  "Playback is unavailable without Spotify Premium";
const FORCE_SHOW_PREMIUM_ALERT_ON_CONNECT_FOR_TESTING = true;

type SpotifyPlaybackStatus =
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
  activateElement?: () => Promise<void> | void;
  addListener: (event: string, cb: (payload: any) => void) => void;
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
      const prev = window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady = () => {
        prev?.();
        resolve();
      };
      return;
    }

    const script = document.createElement("script");
    script.id = "spotify-player-sdk";
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Spotify SDK"));
    const prev = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      prev?.();
      resolve();
    };
    document.body.appendChild(script);
  });

  if (!window.Spotify) throw new Error("Spotify SDK did not initialize");
  return window.Spotify;
}

/* ── Visualizer bar ─────────────────────────────────────────────── */
function VisualizerBar({
  height,
}: {
  height: number;
}) {
  return (
    <motion.div
      className="bg-[rgba(255,255,255,0.25)] rounded-[100px] shrink-0 w-[2px]"
      animate={{ height }}
      transition={{ duration: 0.14, ease: "easeOut" }}
    />
  );
}

/* ── Auto-scrolling marquee text with edge fade ─────────────────── */
function ScrollingText({
  children,
  className = "",
  center = false,
  fullWidth = true,
}: {
  children: string;
  className?: string;
  center?: boolean;
  fullWidth?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [isActivelyScrolling, setIsActivelyScrolling] = useState(false);
  const shiftRef = useRef(0);
  const offsetRef = useRef(0);
  const cancelRef = useRef<(() => void) | null>(null);
  const GAP = 48;
  const SPEED = 25; // px/s
  const PAUSE_MS = 5000;
  const likelyOverflow = children.length > (center ? 28 : 22);

  const measure = useCallback(() => {
    if (!containerRef.current || !textRef.current) return;
    const cw = containerRef.current.offsetWidth;
    const spans = textRef.current.querySelectorAll("span");
    const tw =
      spans.length > 0 ? spans[0].offsetWidth : textRef.current.scrollWidth;
    const needsScroll = tw > cw + 2;
    setShouldScroll(needsScroll);
    if (needsScroll) {
      shiftRef.current = tw + GAP;
    }
  }, []);

  useLayoutEffect(() => {
    measure();
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    if (textRef.current) ro.observe(textRef.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [measure]);

  // When center changes, smoothly reset scroll to 0 and restart cycle
  useEffect(() => {
    if (!textRef.current) return;

    // Cancel any running animation cycle
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }

    // If we're mid-scroll, smoothly transition back to 0
    if (offsetRef.current > 0) {
      const el = textRef.current;
      el.style.transition = "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)";
      el.style.transform = "translateX(0px)";
      offsetRef.current = 0;
      setIsActivelyScrolling(false);

      const onEnd = () => {
        el.style.transition = "";
        el.removeEventListener("transitionend", onEnd);
      };
      el.addEventListener("transitionend", onEnd);
      // Fallback in case transitionend doesn't fire
      const fallback = setTimeout(() => {
        el.style.transition = "";
        el.removeEventListener("transitionend", onEnd);
      }, 350);

      return () => {
        clearTimeout(fallback);
        el.removeEventListener("transitionend", onEnd);
      };
    } else {
      if (textRef.current) {
        textRef.current.style.transform = "translateX(0px)";
        textRef.current.style.transition = "";
      }
      setIsActivelyScrolling(false);
    }
  }, [center]);

  // JS-driven scroll loop with pauses
  useEffect(() => {
    if (!shouldScroll || !textRef.current) return;

    let rafId: number;
    let pauseTimer: ReturnType<typeof setTimeout>;
    let lastTime: number | null = null;
    let cancelled = false;

    const applyTransform = (px: number) => {
      if (textRef.current) {
        textRef.current.style.transform = `translateX(-${px}px)`;
      }
    };

    const tick = (time: number) => {
      if (cancelled) return;
      if (lastTime === null) lastTime = time;
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      offsetRef.current += SPEED * dt;

      if (offsetRef.current >= shiftRef.current) {
        // Completed one full scroll — reset and pause
        offsetRef.current = 0;
        applyTransform(0);
        setIsActivelyScrolling(false);
        pauseTimer = setTimeout(startScrolling, PAUSE_MS);
        return;
      }

      applyTransform(offsetRef.current);
      rafId = requestAnimationFrame(tick);
    };

    const startScrolling = () => {
      if (cancelled) return;
      setIsActivelyScrolling(true);
      lastTime = null;
      rafId = requestAnimationFrame(tick);
    };

    // Initial pause before first scroll
    offsetRef.current = 0;
    applyTransform(0);
    pauseTimer = setTimeout(startScrolling, PAUSE_MS);

    const cleanup = () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      clearTimeout(pauseTimer);
    };

    cancelRef.current = cleanup;

    return cleanup;
  }, [shouldScroll, center, children]);

  // Determine mask: left fade only when actively scrolling, right fade always when scrollable
  const getMask = () => {
    if (!shouldScroll && !likelyOverflow) return undefined;
    if (isActivelyScrolling) {
      return {
        maskImage:
          "linear-gradient(to right, transparent 0%, black 3%, black 93%, transparent 97%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, black 3%, black 93%, transparent 97%)",
      };
    }
    return {
      maskImage:
        "linear-gradient(to right, black 0%, black 93%, transparent 97%)",
      WebkitMaskImage:
        "linear-gradient(to right, black 0%, black 93%, transparent 97%)",
    };
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${fullWidth ? "w-full" : "max-w-full"} ${
        center && !shouldScroll ? "text-center" : ""
      }`}
      style={getMask()}
    >
      <span
        ref={textRef}
        className={`inline-flex whitespace-nowrap ${className}`}
        style={shouldScroll ? { gap: `${GAP}px` } : undefined}
      >
        <span>{children}</span>
        {shouldScroll && isActivelyScrolling && <span aria-hidden>{children}</span>}
      </span>
    </div>
  );
}

/* ── Icons (32px) ───────────────────────────────────────────────── */
function IconFastForward({ reversed = false }: { reversed?: boolean }) {
  return (
    <div
      className={`relative size-[32px] ${
        reversed ? "-scale-y-100 rotate-180" : ""
      }`}
    >
      <svg
        className="absolute block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 32 32"
      >
        <path d={svgPaths.p1bcae800} fill="white" fillOpacity="0.5" />
      </svg>
    </div>
  );
}

function IconPlay() {
  return (
    <div className="relative size-[32px]">
      <svg
        className="absolute block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 32 32"
      >
        <path d={svgPaths.p3a57d900} fill="white" />
      </svg>
    </div>
  );
}

function IconPause() {
  return (
    <div className="relative size-[32px]">
      <svg
        className="absolute block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 24 24"
      >
        <path d={svgPathsPlaying.pb8e7d00} fill="white" />
        <path d={svgPathsPlaying.p2c40c880} fill="white" />
      </svg>
    </div>
  );
}

function SpotifyLogo({
  className = "size-4",
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12.0002 2C6.47735 2 2 6.47723 2 12.0001C2 17.5231 6.47735 22 12.0002 22C17.5236 22 22.0005 17.5231 22.0005 12.0001C22.0005 6.47759 17.5237 2 12.0002 2ZM16.5862 16.423C16.4071 16.7167 16.0226 16.8099 15.7288 16.6295C13.3809 15.1954 10.4251 14.8706 6.94414 15.6659C6.60871 15.7423 6.27434 15.5321 6.19792 15.1966C6.12113 14.861 6.33047 14.5266 6.66674 14.4502C10.4761 13.5796 13.7436 13.9546 16.3796 15.5656C16.6734 15.7459 16.7665 16.1292 16.5862 16.423ZM17.8102 13.6997C17.5845 14.0669 17.1045 14.1827 16.7379 13.957C14.0498 12.3044 9.95233 11.826 6.7729 12.7911C6.36056 12.9156 5.92506 12.6832 5.79991 12.2716C5.67572 11.8593 5.90822 11.4246 6.31984 11.2992C9.95161 10.1973 14.4666 10.731 17.5535 12.6279C17.9201 12.8536 18.0359 13.3336 17.8102 13.6997ZM17.9153 10.8643C14.6923 8.94996 9.37472 8.77394 6.29751 9.70789C5.80337 9.85775 5.28081 9.5788 5.13106 9.08466C4.98132 8.59028 5.26003 8.06808 5.75453 7.91785C9.28695 6.84551 15.1592 7.05269 18.8699 9.25554C19.3153 9.51933 19.461 10.0934 19.1971 10.5372C18.9344 10.9817 18.3583 11.1282 17.9153 10.8643Z"
        fill={color}
      />
    </svg>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */
const PLAYING_HEIGHTS = [16, 4, 14, 8, 12, 4];
const COVER_FLIP_DURATION_MS = 720;
const COVER_FLIP_CLEANUP_BUFFER_MS = 80;

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function createDriftKeyframes(seed: number) {
  const rand = (() => {
    let s = (seed + 1) * 9301 + 49297;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  })();
  const points = 5;
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < points; i += 1) {
    x.push((rand() - 0.5) * 24);
    y.push((rand() - 0.5) * 24);
  }
  x[0] = 0;
  y[0] = 0;
  return { x, y };
}

function isSpotifyPremiumRequiredMessage(message: string | null | undefined) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("premium") || normalized.includes("premium_required");
}

/* ── Main component ─────────────────────────────────────────────── */
export default function DynamicIsland({
  spotifyEnabled = false,
  selectedTrackIndex = 0,
  selectedTrackRequest = 0,
}: {
  spotifyEnabled?: boolean;
  selectedTrackIndex?: number;
  selectedTrackRequest?: number;
}) {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 900
  );
  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [trackIndex, setTrackIndex] = useState(0);
  const track = PLAYLIST[trackIndex];
  const backgroundDrift = useMemo(
    () => createDriftKeyframes(trackIndex),
    [trackIndex]
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyPlaybackStatus>(() =>
    spotifyEnabled
      ? hasSpotifyConfig()
        ? "disconnected"
        : "missing_config"
      : "disconnected"
  );
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [spotifyDurationSec, setSpotifyDurationSec] = useState(0);
  const [currentSpotifyTrackId, setCurrentSpotifyTrackId] = useState<string | null>(
    null
  );
  const [spotifyCtaHover, setSpotifyCtaHover] = useState({
    active: false,
    x: 50,
    y: 50,
  });
  const [spotifyPremiumAlertDismissed, setSpotifyPremiumAlertDismissed] =
    useState(false);
  const [spotifyPremiumAlertTestVisible, setSpotifyPremiumAlertTestVisible] =
    useState(false);
  const [spotifyPremiumAlertHover, setSpotifyPremiumAlertHover] = useState({
    active: false,
    x: 50,
    y: 50,
  });
  const [artExpanded, setArtExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isAutoFlippingCover, setIsAutoFlippingCover] = useState(false);
  const [albumHover, setAlbumHover] = useState({
    active: false,
    x: 50,
    y: 50,
    rotateX: 0,
    rotateY: 0,
    edge: 0,
    edgeX: 50,
    edgeY: 50,
  });
  const [albumCloseImpulse, setAlbumCloseImpulse] = useState({
    x: 50,
    y: 50,
    offsetX: 0,
    offsetY: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
  });
  const [playerHover, setPlayerHover] = useState({
    active: false,
    x: 50,
    y: 50,
    edge: 0,
    edgeX: 50,
    edgeY: 50,
  });
  const [playerRipple, setPlayerRipple] = useState({
    id: 0,
    x: 50,
    y: 50,
  });
  const [visualizerHeights, setVisualizerHeights] = useState<number[]>(
    PLAYING_HEIGHTS.map(() => 4)
  );
  const [spotifyCtaPulseId, setSpotifyCtaPulseId] = useState(0);
  const [spotifyPlayerPulseId, setSpotifyPlayerPulseId] = useState(0);
  const [showIntroShimmer, setShowIntroShimmer] = useState(false);
  const [flipCoverPair, setFlipCoverPair] = useState<{
    front: string;
    back: string;
  } | null>(null);

  // Slider scrubbing state
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringSlider, setIsHoveringSlider] = useState(false);
  const [isHoveringPlaybackControls, setIsHoveringPlaybackControls] = useState(false);
  const [dragOverscroll, setDragOverscroll] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const draggedToEndRef = useRef(false);
  const scrubbedTimeRef = useRef(0);
  const autoFlipTimersRef = useRef<number[]>([]);
  const introShimmerStartTimeoutRef = useRef<number | null>(null);
  const introShimmerEndTimeoutRef = useRef<number | null>(null);
  const suppressBackgroundCloseUntilRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const spotifyPlayerRef = useRef<SpotifyPlayer | null>(null);
  const prevSpotifyStatusRef = useRef<SpotifyPlaybackStatus | null>(null);
  const connectLockedTrackIdRef = useRef<string | null>(null);
  const currentSpotifyTrackIdRef = useRef<string | null>(null);
  const spotifyPositionSecRef = useRef(0);
  const spotifyPositionTsRef = useRef(0);
  const spotifyAnalysisRef = useRef<{
    trackId: string;
    segments: Array<{
      start: number;
      duration: number;
      loudness: number;
      brightness: number;
      bassness: number;
      attack: number;
    }>;
  } | null>(null);
  const spotifyAnalysisSegmentIndexRef = useRef(0);
  const spotifyBootedRef = useRef(false);
  const enforcingPlaylistRef = useRef(false);
  const pendingSpotifyTrackIdRef = useRef<string | null>(null);
  const pendingSpotifyTrackTimerRef = useRef<number | null>(null);
  const spotifyPlayInFlightRef = useRef(false);
  const queuedSpotifyTrackIndexRef = useRef<number | null>(null);
  const spotifyCtaHoverLeaveTimerRef = useRef<number | null>(null);
  const spotifyPremiumAlertHoverLeaveTimerRef = useRef<number | null>(null);
  const spotifyActive = spotifyEnabled;
  const playlistTrackIdSet = useMemo(() => {
    const set = new Set<string>();
    PLAYLIST.forEach((item) => {
      const id = extractTrackId(item.songLink);
      if (id) set.add(id);
    });
    return set;
  }, []);

  const activeDurationSec = spotifyEnabled
    ? Math.max(0, spotifyDurationSec)
    : track.duration;

  useEffect(() => {
    if (spotifyEnabled) return;
    if (!isPlaying) return;
    const id = setInterval(() => {
      setCurrentTime((t) => (t >= activeDurationSec ? 0 : t + 1));
    }, 1000);
    return () => clearInterval(id);
  }, [activeDurationSec, isPlaying, spotifyEnabled]);

  useEffect(() => {
    scrubbedTimeRef.current = currentTime;
  }, [currentTime]);

  const progress = Math.max(0, Math.min(1, currentTime / Math.max(1, activeDurationSec)));

  const scrubFromEvent = useCallback(
    (clientX: number) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const rawRatio = (clientX - rect.left) / rect.width;
      const ratio = Math.max(0, Math.min(1, rawRatio));
      const overscroll = rawRatio < 0 ? rawRatio : rawRatio > 1 ? rawRatio - 1 : 0;
      setDragOverscroll(Math.max(-0.32, Math.min(0.32, overscroll)));
      draggedToEndRef.current = ratio >= 1;
      const nextTime = Math.round(ratio * activeDurationSec);
      scrubbedTimeRef.current = nextTime;
      setCurrentTime(nextTime);
    },
    [activeDurationSec]
  );

  const clearAutoFlipTimers = useCallback(() => {
    autoFlipTimersRef.current.forEach((id) => window.clearTimeout(id));
    autoFlipTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearAutoFlipTimers();
  }, [clearAutoFlipTimers]);

  useEffect(() => {
    introShimmerStartTimeoutRef.current = window.setTimeout(() => {
      setShowIntroShimmer(true);
      introShimmerEndTimeoutRef.current = window.setTimeout(() => {
        setShowIntroShimmer(false);
        introShimmerEndTimeoutRef.current = null;
      }, INTRO_SHIMMER_DURATION_MS);
    }, INTRO_DELAY_MS + INTRO_SHIMMER_START_OFFSET_MS);
    return () => {
      if (introShimmerStartTimeoutRef.current !== null) {
        window.clearTimeout(introShimmerStartTimeoutRef.current);
        introShimmerStartTimeoutRef.current = null;
      }
      if (introShimmerEndTimeoutRef.current !== null) {
        window.clearTimeout(introShimmerEndTimeoutRef.current);
        introShimmerEndTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isSpotifyPremiumRequiredMessage(spotifyError)) {
      setSpotifyPremiumAlertDismissed(false);
    }
  }, [spotifyError]);

  useEffect(() => {
    if (!spotifyEnabled) return;
    const prev = prevSpotifyStatusRef.current;
    if (prev && prev !== spotifyStatus) {
      setSpotifyCtaPulseId((id) => id + 1);
      if (spotifyStatus === "ready") {
        setSpotifyPlayerPulseId((id) => id + 1);
      }
    }
    prevSpotifyStatusRef.current = spotifyStatus;
  }, [spotifyEnabled, spotifyStatus]);

  useEffect(() => {
    const shouldAnimateBars =
      spotifyEnabled && spotifyStatus === "ready" && isPlaying;
    if (!shouldAnimateBars) {
      setVisualizerHeights((prev) =>
        prev.every((value) => value === 4) ? prev : PLAYING_HEIGHTS.map(() => 4)
      );
      return;
    }

    const id = window.setInterval(() => {
      const elapsed =
        spotifyPositionTsRef.current > 0
          ? (performance.now() - spotifyPositionTsRef.current) / 1000
          : 0;
      const positionSec = Math.max(
        0,
        spotifyPositionSecRef.current + (isPlaying ? elapsed : 0)
      );
      let loudnessNorm = 0.4;
      let bassness = 0.52;
      let brightness = 0.48;
      let attack = 0.18;
      let localProgress = 0;

      const analysis = spotifyAnalysisRef.current;
      if (analysis?.segments && analysis.segments.length > 0) {
        const segments = analysis.segments;
        let idx = spotifyAnalysisSegmentIndexRef.current;
        idx = Math.max(0, Math.min(idx, segments.length - 1));
        while (
          idx < segments.length - 1 &&
          positionSec >= segments[idx].start + segments[idx].duration
        ) {
          idx += 1;
        }
        while (idx > 0 && positionSec < segments[idx].start) {
          idx -= 1;
        }
        spotifyAnalysisSegmentIndexRef.current = idx;
        const segment = segments[idx];
        loudnessNorm = Math.max(0, Math.min(1, (segment.loudness + 60) / 60));
        bassness = segment.bassness;
        brightness = segment.brightness;
        attack = segment.attack;
        localProgress = Math.max(
          0,
          Math.min(1, (positionSec - segment.start) / segment.duration)
        );
      }

      const transientWidth = Math.max(0.05, Math.min(0.38, 0.18 + attack * 0.5));
      const transientPulse = Math.exp(
        -Math.pow(localProgress - attack, 2) / (2 * transientWidth * transientWidth)
      );
      const bodyEnvelope = 0.38 + 0.62 * Math.sin(localProgress * Math.PI);
      const baseEnergy = 0.18 + loudnessNorm * 0.92;
      const bassEnergy = Math.max(
        0,
        Math.min(1.6, baseEnergy * (0.7 + bassness * 0.95) * (0.75 + transientPulse * 0.9))
      );
      const trebleEnergy = Math.max(
        0,
        Math.min(
          1.6,
          baseEnergy *
            (0.62 + brightness * 1.05) *
            (0.72 + bodyEnvelope * 0.45 + (1 - transientPulse) * 0.32)
        )
      );

      setVisualizerHeights((prev) =>
        prev.map((prevHeight, i) => {
          const bandPos = i / Math.max(1, prev.length - 1);
          const leftWeight = 1 - bandPos;
          const rightWeight = bandPos;
          const bandEnergy = bassEnergy * leftWeight + trebleEnergy * rightWeight;
          const harmonic = 0.64 + 0.36 * Math.sin(positionSec * (5.6 + bandPos * 6.4) + i * 1.12);
          const emphasis = 0.94 + (leftWeight > rightWeight ? bassness : brightness) * 0.68;
          const targetHeight = Math.max(
            4,
            Math.min(20, 4 + bandEnergy * emphasis * harmonic * (8.2 + i * 0.46))
          );
          const smoothing = 0.5;
          return prevHeight + (targetHeight - prevHeight) * smoothing;
        })
      );
    }, 62);

    return () => window.clearInterval(id);
  }, [isPlaying, spotifyEnabled, spotifyStatus]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      spotifyPlayerRef.current?.disconnect();
      spotifyPlayerRef.current = null;
      enforcingPlaylistRef.current = false;
      connectLockedTrackIdRef.current = null;
      spotifyAnalysisRef.current = null;
      spotifyAnalysisSegmentIndexRef.current = 0;
      spotifyPositionSecRef.current = 0;
      spotifyPositionTsRef.current = 0;
      if (pendingSpotifyTrackTimerRef.current !== null) {
        window.clearTimeout(pendingSpotifyTrackTimerRef.current);
        pendingSpotifyTrackTimerRef.current = null;
      }
      pendingSpotifyTrackIdRef.current = null;
      spotifyPlayInFlightRef.current = false;
      queuedSpotifyTrackIndexRef.current = null;
      if (spotifyCtaHoverLeaveTimerRef.current !== null) {
        window.clearTimeout(spotifyCtaHoverLeaveTimerRef.current);
        spotifyCtaHoverLeaveTimerRef.current = null;
      }
      if (spotifyPremiumAlertHoverLeaveTimerRef.current !== null) {
        window.clearTimeout(spotifyPremiumAlertHoverLeaveTimerRef.current);
        spotifyPremiumAlertHoverLeaveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!spotifyActive || spotifyBootedRef.current) return;
    spotifyBootedRef.current = true;
    const url = new URL(window.location.href);
    const hasAuthParams =
      url.searchParams.has("code") || url.searchParams.has("error");

    (async () => {
      if (hasAuthParams) {
        try {
          await completeSpotifyAuthFromUrl();
        } catch (error) {
          setSpotifyStatus("error");
          setSpotifyError((error as Error).message);
          return;
        }
      }

      const token = await getValidSpotifyAccessToken();
      if (!token) return;
      await connectSpotifyPlayer();
    })();
  }, [spotifyActive]);

  useEffect(() => {
    if (!spotifyActive || selectedTrackRequest <= 0) return;
    setTrackIndex((selectedTrackIndex + PLAYLIST.length) % PLAYLIST.length);
    setCurrentTime(0);
    void playSpotifyTrackByIndex(selectedTrackIndex);
  }, [selectedTrackIndex, selectedTrackRequest, spotifyActive]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDragging) {
      root.classList.add("is-scrubbing");
      return () => {
        root.classList.remove("is-scrubbing");
      };
    }
    root.classList.remove("is-scrubbing");
  }, [isDragging]);

  const advanceToNext = useCallback(
    (mode: "manual" | "manual_with_flip" | "auto") => {
      if (spotifyActive && spotifyStatus === "ready") {
        void playSpotifyTrackByIndex(trackIndex + 1);
        return;
      }
      if ((mode === "auto" || mode === "manual_with_flip") && !isAutoFlippingCover) {
        const nextIndex = (trackIndex + 1) % PLAYLIST.length;
        setFlipCoverPair({
          front: PLAYLIST[trackIndex].albumCover,
          back: PLAYLIST[nextIndex].albumCover,
        });
        setIsAutoFlippingCover(true);
        clearAutoFlipTimers();
        autoFlipTimersRef.current = [
          window.setTimeout(() => {
            setTrackIndex(nextIndex);
            setCurrentTime(0);
          }, COVER_FLIP_DURATION_MS / 2),
          window.setTimeout(() => {
            setIsAutoFlippingCover(false);
            setFlipCoverPair(null);
          }, COVER_FLIP_DURATION_MS + COVER_FLIP_CLEANUP_BUFFER_MS),
        ];
        return;
      }
      const nextIndex = (trackIndex + 1) % PLAYLIST.length;
      setTrackIndex(nextIndex);
      setCurrentTime(0);
    },
    [clearAutoFlipTimers, isAutoFlippingCover, spotifyActive, spotifyStatus, trackIndex]
  );

  // Global mouse handlers for slider dragging
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => scrubFromEvent(e.clientX);
    const onUp = () => {
      const shouldAdvance = draggedToEndRef.current;
      const seekSeconds = scrubbedTimeRef.current;
      setIsDragging(false);
      setIsHoveringSlider(false);
      setDragOverscroll(0);
      suppressBackgroundCloseUntilRef.current = performance.now() + 250;
      draggedToEndRef.current = false;
      if (spotifyActive && spotifyStatus === "ready") {
        if (shouldAdvance) {
          advanceToNext("manual");
          return;
        }
        void seekSpotifyTo(seekSeconds);
        return;
      }
      if (shouldAdvance) {
        advanceToNext("manual_with_flip");
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    advanceToNext,
    isDragging,
    scrubFromEvent,
    spotifyActive,
    spotifyStatus,
  ]);

  const goPrev = useCallback(() => {
    if (spotifyActive && spotifyStatus === "ready") {
      void playSpotifyTrackByIndex(trackIndex - 1);
      return;
    }
    // If more than 3s in, restart current track; otherwise go to previous
    if (currentTime > 3) {
      setCurrentTime(0);
    } else {
      const prevIndex = (trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
      setTrackIndex(prevIndex);
      setCurrentTime(0);
    }
  }, [currentTime, spotifyActive, spotifyStatus, trackIndex]);

  const getAudioContext = useCallback(() => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const Ctx = window.AudioContext || (window as Window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtxRef.current = new Ctx();
    return audioCtxRef.current;
  }, []);

  const playUiClick = useCallback(
    (variant: "soft" | "back" | "forward") => {
      const ctx = getAudioContext();
      if (!ctx) return;
      void ctx.resume();

      const now = ctx.currentTime;
      const duration = 0.052;
      const toneFreq =
        variant === "back" ? 520 : variant === "forward" ? 760 : 620;

      const toneOsc = ctx.createOscillator();
      toneOsc.type = "triangle";
      toneOsc.frequency.setValueAtTime(toneFreq, now);
      toneOsc.frequency.exponentialRampToValueAtTime(toneFreq * 0.72, now + duration);

      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(0.0001, now);
      toneGain.gain.exponentialRampToValueAtTime(0.54, now + 0.0025);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 420;
      hp.Q.value = 0.8;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = variant === "forward" ? 5200 : 4600;
      lp.Q.value = 0.7;

      const out = ctx.createGain();
      out.gain.setValueAtTime(0.75, now);

      toneOsc.connect(toneGain);
      toneGain.connect(hp);
      hp.connect(lp);
      lp.connect(out);
      out.connect(ctx.destination);

      toneOsc.start(now);
      toneOsc.stop(now + duration);
    },
    [getAudioContext]
  );

  const playAlbumWhoosh = useCallback(
    (variant: "open" | "close") => {
      const ctx = getAudioContext();
      if (!ctx) return;
      void ctx.resume();

      const now = ctx.currentTime;
      const duration = 0.8;
      const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let smooth = 0;
      for (let i = 0; i < frameCount; i += 1) {
        const t = i / frameCount;
        // Smoothed wind texture (less grainy than raw white noise).
        const envelope = Math.pow(1 - t, 2.6);
        const white = Math.random() * 2 - 1;
        smooth = smooth * 0.94 + white * 0.06;
        data[i] = smooth * envelope;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 0.34;
      if (variant === "open") {
        band.frequency.setValueAtTime(420, now);
        band.frequency.exponentialRampToValueAtTime(1320, now + duration);
      } else {
        band.frequency.setValueAtTime(1320, now);
        band.frequency.exponentialRampToValueAtTime(420, now + duration);
      }

      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.setValueAtTime(170, now);

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(2200, now);
      lowpass.frequency.exponentialRampToValueAtTime(1300, now + duration);

      const gain = ctx.createGain();
      const peak = variant === "open" ? 0.7 : 0.7;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      source.connect(band);
      band.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(ctx.destination);
      source.start(now);
      source.stop(now + duration);
    },
    [getAudioContext]
  );

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
        if (response.status === 404 && text.includes("Device not found")) {
          throw new Error("Spotify device unavailable");
        }
        if (response.status === 403 && isSpotifyPremiumRequiredMessage(text)) {
          throw new Error(SPOTIFY_PREMIUM_REQUIRED_ERROR);
        }
        throw new Error(`Spotify API ${response.status}`);
      }
    },
    []
  );

  const reactivateSpotifyDevice = useCallback(
    async (deviceId: string) => {
      await callSpotifyApi("/me/player", {
        method: "PUT",
        body: JSON.stringify({ device_ids: [deviceId], play: false }),
      });
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 180);
      });
    },
    [callSpotifyApi]
  );

  const ensureSpotifyDeviceActive = useCallback(
    async (deviceId: string, attempts = 3) => {
      let lastError: Error | null = null;
      for (let i = 0; i < attempts; i += 1) {
        try {
          await reactivateSpotifyDevice(deviceId);
          return;
        } catch (error) {
          lastError = error as Error;
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 180 + i * 140);
          });
        }
      }
      if (lastError) throw lastError;
    },
    [reactivateSpotifyDevice]
  );

  const wait = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }, []);

  const loadSpotifyTrackAnalysis = useCallback(async (trackId: string) => {
    if (!trackId) return;
    if (spotifyAnalysisRef.current?.trackId === trackId) return;
    try {
      const token = await getValidSpotifyAccessToken();
      if (!token) return;
      const response = await fetch(
        `https://api.spotify.com/v1/audio-analysis/${trackId}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        segments?: Array<{
          start?: number;
          duration?: number;
          loudness_max?: number;
          loudness_max_time?: number;
          timbre?: number[];
        }>;
      };
      const segments = Array.isArray(payload.segments)
        ? payload.segments
            .map((segment) => ({
              start: Math.max(0, Number(segment.start ?? 0)),
              duration: Math.max(0.02, Number(segment.duration ?? 0.02)),
              loudness: Math.max(-60, Math.min(0, Number(segment.loudness_max ?? -24))),
              brightness: Math.max(
                0,
                Math.min(1, (Number(segment.timbre?.[1] ?? 0) + 120) / 240)
              ),
              bassness: Math.max(
                0,
                Math.min(1, (120 - Number(segment.timbre?.[1] ?? 0)) / 240)
              ),
              attack: Math.max(
                0,
                Math.min(
                  1,
                  Number(segment.loudness_max_time ?? 0.18) /
                    Math.max(0.02, Number(segment.duration ?? 0.02))
                )
              ),
            }))
            .filter((segment) => Number.isFinite(segment.start))
        : [];
      spotifyAnalysisRef.current = { trackId, segments };
      spotifyAnalysisSegmentIndexRef.current = 0;
    } catch {
      // Keep visualizer fallback behavior if analysis fetch fails.
    }
  }, []);

  const playSpotifyTrackByIndex = useCallback(
    async (nextIndex: number, forceDeviceId?: string) => {
      const activeDeviceId = forceDeviceId ?? spotifyDeviceId;
      if (!spotifyActive || !activeDeviceId) return;
      const wrapped = (nextIndex + PLAYLIST.length) % PLAYLIST.length;
      queuedSpotifyTrackIndexRef.current = wrapped;
      if (spotifyPlayInFlightRef.current) return;
      spotifyPlayInFlightRef.current = true;

      try {
        while (queuedSpotifyTrackIndexRef.current !== null) {
          const targetIndex = queuedSpotifyTrackIndexRef.current;
          queuedSpotifyTrackIndexRef.current = null;
          const trackId = extractTrackId(PLAYLIST[targetIndex].songLink);
          if (!trackId) continue;
          if (connectLockedTrackIdRef.current) {
            connectLockedTrackIdRef.current = trackId;
          }

          pendingSpotifyTrackIdRef.current = trackId;
          if (pendingSpotifyTrackTimerRef.current !== null) {
            window.clearTimeout(pendingSpotifyTrackTimerRef.current);
          }
          pendingSpotifyTrackTimerRef.current = window.setTimeout(() => {
            pendingSpotifyTrackIdRef.current = null;
            pendingSpotifyTrackTimerRef.current = null;
          }, 5000);

          setTrackIndex(targetIndex);
          setCurrentTime(0);
          setIsPlaying(true);
          setSpotifyDurationSec(0);

          let played = false;
          let unavailableRetries = 0;
          while (!played) {
            try {
              await callSpotifyApi(`/me/player/play?device_id=${activeDeviceId}`, {
                method: "PUT",
                body: JSON.stringify({
                  uris: [`spotify:track:${trackId}`],
                }),
              });
              played = true;
            } catch (error) {
              const message = (error as Error).message;
              if (message === SPOTIFY_PREMIUM_REQUIRED_ERROR) {
                setSpotifyStatus("error");
                setSpotifyError(SPOTIFY_PREMIUM_REQUIRED_ERROR);
                break;
              }
              if (message === "Spotify device unavailable" && activeDeviceId) {
                if (unavailableRetries >= 3) {
                  setSpotifyStatus("disconnected");
                  setSpotifyDeviceId(null);
                  pendingSpotifyTrackIdRef.current = null;
                  if (pendingSpotifyTrackTimerRef.current !== null) {
                    window.clearTimeout(pendingSpotifyTrackTimerRef.current);
                    pendingSpotifyTrackTimerRef.current = null;
                  }
                  setSpotifyError(
                    "Spotify device unavailable. Press Play with Spotify Premium to reconnect."
                  );
                  queuedSpotifyTrackIndexRef.current = null;
                  break;
                }
                unavailableRetries += 1;
                try {
                  await ensureSpotifyDeviceActive(activeDeviceId, 4 + unavailableRetries);
                  continue;
                } catch {
                  // fall through to existing unavailable handling
                }
              }
              if (message === "Spotify device unavailable") break;
              setSpotifyError(message);
              break;
            }
          }
        }
      } finally {
        spotifyPlayInFlightRef.current = false;
      }
    },
    [callSpotifyApi, ensureSpotifyDeviceActive, spotifyActive, spotifyDeviceId]
  );

  const seekSpotifyTo = useCallback(
    async (seconds: number) => {
      if (!spotifyActive || spotifyStatus !== "ready" || !spotifyDeviceId) return;
      const maxDuration = spotifyDurationSec > 0 ? spotifyDurationSec : activeDurationSec;
      const clampedSeconds = Math.max(0, Math.min(maxDuration, seconds));
      const positionMs = Math.round(clampedSeconds * 1000);
      try {
        let sought = false;
        let unavailableRetries = 0;
        while (!sought) {
          try {
            await callSpotifyApi(
              `/me/player/seek?position_ms=${positionMs}&device_id=${spotifyDeviceId}`,
              { method: "PUT" }
            );
            sought = true;
          } catch (error) {
            const message = (error as Error).message;
            if (message === "Spotify device unavailable" && spotifyDeviceId) {
              if (unavailableRetries >= 2) throw error;
              unavailableRetries += 1;
              try {
                await ensureSpotifyDeviceActive(spotifyDeviceId, 4 + unavailableRetries);
                continue;
              } catch {
                // fall through to existing unavailable handling
              }
            }
            throw error;
          }
        }
      } catch (error) {
        const message = (error as Error).message;
        if (message === SPOTIFY_PREMIUM_REQUIRED_ERROR) {
          setSpotifyStatus("error");
          setSpotifyError(SPOTIFY_PREMIUM_REQUIRED_ERROR);
          return;
        }
        if (message === "Spotify device unavailable") {
          setSpotifyStatus("disconnected");
          setSpotifyDeviceId(null);
          setSpotifyError(
            "Spotify device unavailable. Press Play with Spotify Premium to reconnect."
          );
          return;
        }
        setSpotifyError(message);
        return;
      }
      setCurrentTime(clampedSeconds);
    },
    [
      activeDurationSec,
      callSpotifyApi,
      ensureSpotifyDeviceActive,
      spotifyDeviceId,
      spotifyDurationSec,
      spotifyActive,
      spotifyStatus,
    ]
  );

  const connectSpotifyPlayer = useCallback(async (preferActivation = false) => {
    if (!spotifyActive) return;
    if (!hasSpotifyConfig()) {
      setSpotifyStatus("missing_config");
      setSpotifyError("Add VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_REDIRECT_URI in .env.local");
      return;
    }
    if (FORCE_SHOW_PREMIUM_ALERT_ON_CONNECT_FOR_TESTING) {
      setSpotifyPremiumAlertTestVisible(true);
      setSpotifyPremiumAlertDismissed(false);
    }

    try {
      if (spotifyPlayerRef.current) {
        spotifyPlayerRef.current.disconnect();
        spotifyPlayerRef.current = null;
      }
      setSpotifyError(null);
      setSpotifyPremiumAlertDismissed(false);
      setSpotifyDeviceId(null);
      setCurrentSpotifyTrackId(null);
      setSpotifyDurationSec(0);
      setIsPlaying(false);
      connectLockedTrackIdRef.current = extractTrackId(PLAYLIST[trackIndex].songLink);
      if (pendingSpotifyTrackTimerRef.current !== null) {
        window.clearTimeout(pendingSpotifyTrackTimerRef.current);
        pendingSpotifyTrackTimerRef.current = null;
      }
      pendingSpotifyTrackIdRef.current = null;
      spotifyPlayInFlightRef.current = false;
      queuedSpotifyTrackIndexRef.current = null;
      setSpotifyStatus("connecting");
      const sdk = await loadSpotifySdk();
      const player = new sdk.Player({
        name: "Raghav New Music Player",
        getOAuthToken: async (cb) => {
          const token = await getValidSpotifyAccessToken();
          cb(token ?? "");
        },
        volume: 0.7,
      });
      if (preferActivation) {
        try {
          await player.activateElement?.();
        } catch {
          // Best-effort for autoplay policies.
        }
      }

      player.addListener("ready", async ({ device_id }: { device_id: string }) => {
        setSpotifyDeviceId(device_id);
        setCurrentSpotifyTrackId(null);
        currentSpotifyTrackIdRef.current = null;
        setSpotifyStatus("ready");
        setSpotifyError(null);
        const expectedTrackId = extractTrackId(PLAYLIST[trackIndex].songLink);
        connectLockedTrackIdRef.current = expectedTrackId;
        try {
          await ensureSpotifyDeviceActive(device_id, 6);
          await wait(140);
          for (let attempt = 0; attempt < 5; attempt += 1) {
            await playSpotifyTrackByIndex(trackIndex, device_id);
            await wait(200 + attempt * 120);
            if (
              expectedTrackId &&
              currentSpotifyTrackIdRef.current === expectedTrackId
            ) {
              break;
            }
            await ensureSpotifyDeviceActive(device_id, 4 + attempt);
          }
        } catch {
          // Do not surface a hard error here; playback actions will retry activation.
        }
      });

      player.addListener("authentication_error", ({ message }: { message: string }) => {
        setSpotifyStatus("error");
        setSpotifyError(message);
      });
      player.addListener("account_error", ({ message }: { message: string }) => {
        setSpotifyStatus("error");
        if (isSpotifyPremiumRequiredMessage(message)) {
          setSpotifyError(SPOTIFY_PREMIUM_REQUIRED_ERROR);
          return;
        }
        setSpotifyError(message);
      });
      player.addListener("playback_error", ({ message }: { message: string }) => {
        setSpotifyStatus("error");
        if (isSpotifyPremiumRequiredMessage(message)) {
          setSpotifyError(SPOTIFY_PREMIUM_REQUIRED_ERROR);
          return;
        }
        setSpotifyError(message);
      });
      player.addListener("player_state_changed", (state: any) => {
        if (!state) return;
        const uri: string | undefined = state.track_window?.current_track?.uri;
        if (!uri) return;
        const uriTrackId = uri.split(":")[2];
        setCurrentSpotifyTrackId(uriTrackId ?? null);
        currentSpotifyTrackIdRef.current = uriTrackId ?? null;
        spotifyPositionSecRef.current = Math.max(0, (state.position ?? 0) / 1000);
        spotifyPositionTsRef.current = performance.now();
        if (uriTrackId) {
          void loadSpotifyTrackAnalysis(uriTrackId);
        }

        const connectLockTrackId = connectLockedTrackIdRef.current;
        if (connectLockTrackId) {
          if (uriTrackId !== connectLockTrackId) {
            // Ignore transient SDK states during connect handoff.
            return;
          }
          connectLockedTrackIdRef.current = null;
        }

        if (spotifyActive && uriTrackId && !playlistTrackIdSet.has(uriTrackId)) {
          if (enforcingPlaylistRef.current) return;
          enforcingPlaylistRef.current = true;
          void playSpotifyTrackByIndex(trackIndex).finally(() => {
            window.setTimeout(() => {
              enforcingPlaylistRef.current = false;
            }, 300);
          });
          return;
        }

        const pendingTrackId = pendingSpotifyTrackIdRef.current;
        if (pendingTrackId && uriTrackId !== pendingTrackId) {
          // Ignore stale state updates while waiting for requested track to load.
          return;
        }
        if (pendingTrackId && uriTrackId === pendingTrackId) {
          pendingSpotifyTrackIdRef.current = null;
          if (pendingSpotifyTrackTimerRef.current !== null) {
            window.clearTimeout(pendingSpotifyTrackTimerRef.current);
            pendingSpotifyTrackTimerRef.current = null;
          }
        }

        setIsPlaying(!state.paused);
        setCurrentTime(Math.floor((state.position ?? 0) / 1000));
        const durationSec = Math.floor((state.duration ?? 0) / 1000);
        if (durationSec > 0) setSpotifyDurationSec(durationSec);

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
      spotifyPlayerRef.current = player;
    } catch (error) {
      setSpotifyStatus("error");
      setSpotifyError((error as Error).message);
    }
  }, [
    ensureSpotifyDeviceActive,
    loadSpotifyTrackAnalysis,
    playlistTrackIdSet,
    playSpotifyTrackByIndex,
    spotifyActive,
    trackIndex,
    wait,
  ]);

  const openCurrentTrack = useCallback(() => {
    window.open(track.songLink, "_blank", "noopener,noreferrer");
  }, [track.songLink]);

  const handleExpandedAlbumPointerMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      const clampedX = Math.max(0, Math.min(1, nx));
      const clampedY = Math.max(0, Math.min(1, ny));
      const edgeCandidates = [
        { d: clampedX, ex: 0, ey: clampedY },
        { d: 1 - clampedX, ex: 1, ey: clampedY },
        { d: clampedY, ex: clampedX, ey: 0 },
        { d: 1 - clampedY, ex: clampedX, ey: 1 },
      ];
      const nearestEdge = edgeCandidates.reduce((best, current) =>
        current.d < best.d ? current : best
      );
      const edgeDistanceNorm = nearestEdge.d;
      const edge = Math.max(0, Math.min(1, (0.24 - edgeDistanceNorm) / 0.24));
      setAlbumHover({
        active: true,
        x: clampedX * 100,
        y: clampedY * 100,
        rotateX: (0.5 - clampedY) * 9,
        rotateY: (clampedX - 0.5) * 11,
        edge,
        edgeX: nearestEdge.ex * 100,
        edgeY: nearestEdge.ey * 100,
      });
    },
    []
  );

  const handlePlayerPointerMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      const clampedX = Math.max(0, Math.min(1, nx));
      const clampedY = Math.max(0, Math.min(1, ny));
      const edgeCandidates = [
        { d: clampedX, ex: 0, ey: clampedY },
        { d: 1 - clampedX, ex: 1, ey: clampedY },
        { d: clampedY, ex: clampedX, ey: 0 },
        { d: 1 - clampedY, ex: clampedX, ey: 1 },
      ];
      const nearestEdge = edgeCandidates.reduce((best, current) =>
        current.d < best.d ? current : best
      );
      const edgeDistanceNorm = nearestEdge.d;
      const edge = Math.max(0, Math.min(1, (0.24 - edgeDistanceNorm) / 0.24));
      setPlayerHover({
        active: true,
        x: clampedX * 100,
        y: clampedY * 100,
        edge,
        edgeX: nearestEdge.ex * 100,
        edgeY: nearestEdge.ey * 100,
      });
    },
    []
  );

  const triggerPlayerRipple = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const clampedX = Math.max(0, Math.min(1, nx));
    const clampedY = Math.max(0, Math.min(1, ny));
    setPlayerRipple((prev) => ({
      id: prev.id + 1,
      x: clampedX * 100,
      y: clampedY * 100,
    }));
  }, []);

  const togglePlayPause = useCallback(() => {
    if (spotifyActive && spotifyStatus === "ready" && spotifyPlayerRef.current) {
      if (isPlaying) {
        void spotifyPlayerRef.current.pause();
      } else {
        if (!currentSpotifyTrackId || !playlistTrackIdSet.has(currentSpotifyTrackId)) {
          void playSpotifyTrackByIndex(trackIndex);
          return;
        }
        void spotifyPlayerRef.current.resume();
      }
      setIsPlaying((prev) => !prev);
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [
    currentSpotifyTrackId,
    isPlaying,
    playSpotifyTrackByIndex,
    playlistTrackIdSet,
    spotifyActive,
    spotifyStatus,
    trackIndex,
  ]);

  const disconnectSpotify = useCallback(() => {
    spotifyPlayerRef.current?.disconnect();
    spotifyPlayerRef.current = null;
    spotifyPlayInFlightRef.current = false;
    queuedSpotifyTrackIndexRef.current = null;
    pendingSpotifyTrackIdRef.current = null;
    connectLockedTrackIdRef.current = null;
    spotifyAnalysisRef.current = null;
    spotifyAnalysisSegmentIndexRef.current = 0;
    spotifyPositionSecRef.current = 0;
    spotifyPositionTsRef.current = 0;
    if (pendingSpotifyTrackTimerRef.current !== null) {
      window.clearTimeout(pendingSpotifyTrackTimerRef.current);
      pendingSpotifyTrackTimerRef.current = null;
    }
    setCurrentSpotifyTrackId(null);
    setSpotifyDeviceId(null);
    setSpotifyDurationSec(0);
    setSpotifyStatus("disconnected");
    setSpotifyError(null);
    setSpotifyPremiumAlertTestVisible(false);
    setIsPlaying(false);
  }, []);

  const closeExpandedFromCover = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      const clampedX = Math.max(0, Math.min(1, nx));
      const clampedY = Math.max(0, Math.min(1, ny));
      const offsetX = clampedX - 0.5;
      const offsetY = clampedY - 0.5;
      setAlbumCloseImpulse({
        x: clampedX * 100,
        y: clampedY * 100,
        offsetX,
        offsetY,
        rotateX: (0.5 - clampedY) * 14,
        rotateY: (clampedX - 0.5) * 16,
        rotateZ: offsetX * 8,
      });
      playAlbumWhoosh("close");
      setArtExpanded(false);
    },
    [playAlbumWhoosh]
  );

  // Auto-advance to next track when current one finishes
  useEffect(() => {
    if (spotifyActive) return;
    if (
      isPlaying &&
      !isDragging &&
      !isAutoFlippingCover &&
      currentTime >= track.duration
    ) {
      advanceToNext("auto");
    }
  }, [
    advanceToNext,
    currentTime,
    isAutoFlippingCover,
    isDragging,
    isPlaying,
    spotifyActive,
    track.duration,
  ]);

  const sliderActive = isDragging || isHoveringSlider;
  const isMobile = viewportWidth < 768;
  const showPlaybackControls =
    isMobile ||
    playerHover.active ||
    isDragging ||
    artExpanded ||
    isHoveringPlaybackControls ||
    (spotifyEnabled && spotifyStatus !== "ready");
  const showSpotifyConnectCta = spotifyEnabled && spotifyStatus !== "ready";
  const spotifyCtaLabel = "Play with Spotify Premium";
  const spotifyCtaBusy = spotifyStatus === "connecting";
  const shouldObscureSpotifyTime = spotifyEnabled && spotifyStatus !== "ready";
  const currentTimeLabel = shouldObscureSpotifyTime ? "0:00" : formatTime(currentTime);
  const durationTimeLabel = shouldObscureSpotifyTime
    ? "0:00"
    : formatTime(activeDurationSec);
  const playerWidth = Math.max(264, Math.min(332, viewportWidth - 48));
  const albumSize = Math.max(236, Math.min(320, playerWidth - 12));
  const playerIntroStartOffset = Math.max(420, Math.floor(viewportHeight * 0.68));
  const showSpotifyPremiumAlert =
    (FORCE_SHOW_PREMIUM_ALERT_ON_CONNECT_FOR_TESTING && spotifyPremiumAlertTestVisible) ||
    isSpotifyPremiumRequiredMessage(spotifyError);
  const sliderStretch = isDragging
    ? {
        widthOffset: Math.abs(dragOverscroll) * 30,
        xOffset: dragOverscroll * 16,
        height: 10 - Math.abs(dragOverscroll) * 6,
      }
    : { widthOffset: 0, xOffset: 0, height: 6 };
  const spotifyConnectCta = showSpotifyConnectCta ? (
    <motion.button
      type="button"
      className="relative inline-flex cursor-pointer items-center gap-[2px] overflow-hidden whitespace-nowrap rounded-full bg-[rgba(40,40,40,0.45)] px-[8px] py-[3px] text-[14px] text-white/90"
      aria-busy={spotifyCtaBusy}
      disabled={spotifyCtaBusy}
      animate={{
        scaleX: spotifyStatus === "connecting" ? 0.88 : 1,
      }}
      transition={{
        scaleX: { duration: 0.34, ease: [0.22, 0.8, 0.26, 1] },
      }}
      style={{
        background: "rgba(40,40,40,0.45)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow:
          "0 8px 24px rgba(0,0,0,0.22), inset 0 0.5px 0 rgba(255,255,255,0.1)",
        cursor: spotifyCtaBusy ? "default" : "pointer",
        opacity: spotifyCtaBusy ? 0.9 : 1,
      }}
      onMouseEnter={() => {
        if (spotifyCtaHoverLeaveTimerRef.current !== null) {
          window.clearTimeout(spotifyCtaHoverLeaveTimerRef.current);
          spotifyCtaHoverLeaveTimerRef.current = null;
        }
        setSpotifyCtaHover((prev) => ({ ...prev, active: true }));
      }}
      onMouseLeave={() => {
        if (spotifyCtaHoverLeaveTimerRef.current !== null) {
          window.clearTimeout(spotifyCtaHoverLeaveTimerRef.current);
        }
        spotifyCtaHoverLeaveTimerRef.current = window.setTimeout(() => {
          setSpotifyCtaHover((prev) => ({ ...prev, active: false }));
          spotifyCtaHoverLeaveTimerRef.current = null;
        }, 140);
      }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top) / rect.height;
        const clampedX = Math.max(0, Math.min(1, nx));
        const clampedY = Math.max(0, Math.min(1, ny));
        setSpotifyCtaHover({
          active: true,
          x: clampedX * 100,
          y: clampedY * 100,
        });
      }}
      onClick={() => {
        if (spotifyStatus === "connecting") return;
        if (!hasSpotifyConfig()) {
          setSpotifyStatus("missing_config");
          setSpotifyError(
            "Add VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_REDIRECT_URI in .env.local"
          );
          return;
        }
        void (async () => {
          const token = await getValidSpotifyAccessToken();
          if (token) {
            await connectSpotifyPlayer(true);
            return;
          }
          await startSpotifyLogin();
        })();
      }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: spotifyCtaHover.active ? 0.92 : 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        style={{
          background: `radial-gradient(120px 72px at ${spotifyCtaHover.x}% ${spotifyCtaHover.y}%, rgba(255,255,255,0.42), rgba(255,255,255,0.12) 46%, rgba(255,255,255,0) 78%)`,
          filter: "blur(5px) saturate(1.04)",
        }}
      />
      {spotifyCtaPulseId > 0 && (
        <motion.div
          key={`cta-sync-${spotifyCtaPulseId}`}
          className="absolute inset-0 pointer-events-none"
          initial={{ x: "-120%", opacity: 0 }}
          animate={{ x: "120%", opacity: [0, 0.76, 0.24, 0] }}
          transition={{
            duration: 0.86,
            ease: [0.25, 0.85, 0.25, 1],
          }}
          style={{
            background:
              "linear-gradient(100deg, rgba(255,255,255,0) 18%, rgba(255,255,255,0.58) 48%, rgba(255,255,255,0.2) 64%, rgba(255,255,255,0) 86%)",
            mixBlendMode: "screen",
            filter: "blur(6px)",
          }}
        />
      )}
      <SpotifyLogo
        className="size-[17px]"
        color="rgba(255,255,255,0.78)"
      />
      <motion.span
        className="whitespace-nowrap"
        animate={{
          opacity: spotifyStatus === "connecting" ? 0 : 1,
          y: spotifyStatus === "connecting" ? -2 : 0,
          maxWidth: spotifyStatus === "connecting" ? 0 : 240,
          marginLeft: spotifyStatus === "connecting" ? 0 : 2,
          filter: spotifyStatus === "connecting" ? "blur(2px)" : "blur(0px)",
        }}
        transition={{ duration: 0.24, ease: [0.22, 0.8, 0.26, 1] }}
        style={{ overflow: "hidden" }}
      >
        {spotifyCtaLabel}
      </motion.span>
    </motion.button>
  ) : null;

  return (
    <div
      className="relative flex h-full items-end justify-center overflow-hidden pb-[48px] select-none"
      style={{
        backgroundColor: artExpanded ? "#000" : "transparent",
        transition: "background-color 0.6s ease",
        userSelect: "none",
        WebkitUserSelect: "none",
        cursor: artExpanded ? "pointer" : "default",
        pointerEvents: "none",
        paddingBottom: "calc(48px + env(safe-area-inset-bottom))",
      }}
    >
      {artExpanded && (
        <div
          className="absolute inset-0"
          style={{ zIndex: 9, pointerEvents: "auto" }}
          onClick={() => {
            if (performance.now() < suppressBackgroundCloseUntilRef.current) return;
            playAlbumWhoosh("close");
            setArtExpanded(false);
          }}
        />
      )}

      {/* Edge blur falloff */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          zIndex: 5,
          height: 120,
          backdropFilter: "blur(0px)",
          WebkitBackdropFilter: "blur(0px)",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 28%, rgba(0,0,0,0.35) 68%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 28%, rgba(0,0,0,0.35) 68%, rgba(0,0,0,0) 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          zIndex: 20,
          height: 24,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          maskImage:
            "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 28%, rgba(0,0,0,0.35) 68%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 28%, rgba(0,0,0,0.35) 68%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* ── Full-screen blurred album background ──────────────── */}
      <AnimatePresence mode="sync" initial={false}>
        {artExpanded && (
          <>
            <motion.img
              key={track.albumCover}
              src={track.albumCover}
              alt=""
              initial={{ opacity: 0, x: 0, y: 0, scale: 1.35 }}
              animate={{
                opacity: 1,
                scale: 1.35,
                x: backgroundDrift.x,
                y: backgroundDrift.y,
              }}
              exit={{ opacity: 0, x: 0, y: 0, scale: 1.35 }}
              transition={{
                opacity: { duration: 0.8, ease: "easeInOut" },
                scale: { duration: 0.8, ease: "easeInOut" },
                x: { duration: 42, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                y: { duration: 46, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
              }}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{
                filter: "blur(120px) brightness(0.45) saturate(1.6)",
              }}
            />
          </>
        )}
      </AnimatePresence>
      {artExpanded && (
        <img
          src={grainGif}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{
            zIndex: 2,
            opacity: 0.022,
            mixBlendMode: "soft-light",
            filter: "blur(2px) contrast(1.08) brightness(1.01) saturate(1)",
          }}
        />
      )}

      <motion.div
        className="flex flex-col items-center relative z-10 pointer-events-auto"
        initial={{ y: playerIntroStartOffset }}
        animate={{ y: 0 }}
        transition={{
          y: {
            delay: INTRO_DELAY_MS / 1000,
            type: "spring",
            stiffness: 135,
            damping: 26,
            mass: 0.84,
          },
        }}
        style={{
          cursor: artExpanded ? "default" : "auto",
          willChange: "transform",
        }}
        onClick={(e) => {
          if (artExpanded) e.stopPropagation();
        }}
      >
        {/* ── Large album art above widget ──────────────────────── */}
        <AnimatePresence>
          {artExpanded && (
            <motion.div
              key="album-large-wrapper"
              initial={{ height: 0, marginBottom: 0 }}
              animate={{ height: albumSize, marginBottom: 16 }}
              exit={{ height: 0, marginBottom: 0 }}
              transition={SPRING}
              className="relative"
              style={{ width: albumSize }}
            >
              <motion.div
                key="album-large-content"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{
                  opacity: 0,
                  scale: 0.72,
                  x: albumCloseImpulse.offsetX * 42,
                  y: 94 + Math.abs(albumCloseImpulse.offsetY) * 28,
                  rotateX: albumCloseImpulse.rotateX,
                  rotateY: albumCloseImpulse.rotateY,
                  rotateZ: albumCloseImpulse.rotateZ,
                  filter: "blur(3px)",
                }}
                transition={{
                  duration: 0.46,
                  ease: [0.2, 0.76, 0.24, 1],
                }}
                className="absolute inset-0 cursor-pointer"
                onClick={closeExpandedFromCover}
                style={{
                  transformOrigin: `${albumCloseImpulse.x}% ${albumCloseImpulse.y}%`,
                  transformPerspective: 960,
                }}
              >
                {/* Sharp album art */}
                <motion.div
                  className="relative rounded-[24px] overflow-hidden"
                  onMouseEnter={() =>
                    setAlbumHover((prev) => ({ ...prev, active: true }))
                  }
                  onMouseMove={handleExpandedAlbumPointerMove}
                  onMouseLeave={() =>
                    setAlbumHover((prev) => ({
                      ...prev,
                      active: false,
                      rotateX: 0,
                      rotateY: 0,
                      edge: 0,
                    }))
                  }
                  animate={{
                    rotateX: albumHover.rotateX,
                    rotateY: albumHover.rotateY,
                  }}
                  transition={{ type: "spring", stiffness: 120, damping: 16, mass: 0.55 }}
                  style={{
                    width: albumSize,
                    height: albumSize,
                    opacity: 1,
                    transformStyle: "preserve-3d",
                    transformPerspective: 900,
                  }}
                >
                  {isAutoFlippingCover && flipCoverPair ? (
                    <div className="absolute inset-0" style={{ perspective: 1000 }}>
                      <motion.div
                        className="relative size-full"
                        key={`large-${flipCoverPair.front}-${flipCoverPair.back}`}
                        initial={{ rotateY: 0 }}
                        animate={{ rotateY: -180 }}
                        transition={{
                          duration: COVER_FLIP_DURATION_MS / 1000,
                          ease: [0.32, 0.72, 0, 1],
                        }}
                        style={{
                          transformStyle: "preserve-3d",
                          willChange: "transform",
                          transform: "translateZ(0)",
                        }}
                      >
                        <img
                          alt="Album art"
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                          src={flipCoverPair.front}
                          style={{
                            borderRadius: 24,
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                            transform: "translateZ(0)",
                          }}
                        />
                        <img
                          alt="Next album art"
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                          src={flipCoverPair.back}
                          style={{
                            borderRadius: 24,
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                            transform: "rotateY(-180deg) translateZ(0)",
                          }}
                        />
                      </motion.div>
                    </div>
                  ) : (
                    <img
                      alt="Album art"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      src={track.albumCover}
                    />
                  )}
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    animate={{ opacity: albumHover.active ? 1 : 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    style={{
                      background: `radial-gradient(420px 110px at ${albumHover.x}% ${albumHover.y}%, rgba(255,196,225,0.24), rgba(255,224,241,0.1) 42%, rgba(255,238,247,0.025) 64%, rgba(255,255,255,0) 82%), linear-gradient(135deg, rgba(255,126,186,0.05), rgba(255,178,222,0.04))`,
                      mixBlendMode: "color-dodge",
                      filter: "blur(8px) saturate(1.16) contrast(1.05)",
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    animate={{ opacity: albumHover.active ? 0.22 : 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{
                      background:
                        "linear-gradient(120deg, rgba(0,0,0,0.16), rgba(255,255,255,0.04) 46%, rgba(0,0,0,0.14))",
                      mixBlendMode: "color-burn",
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 pointer-events-none rounded-[24px]"
                    animate={{
                      opacity: albumHover.active ? 0.08 + albumHover.edge * 0.48 : 0,
                    }}
                    transition={{ duration: 0.14, ease: "easeOut" }}
                    style={{
                      border: "1px solid rgba(255,255,255,0.82)",
                      boxShadow:
                        "0 0 14px rgba(255,255,255,0.26), inset 0 0 7px rgba(255,255,255,0.14)",
                      mixBlendMode: "screen",
                      maskImage: `radial-gradient(210px 120px at ${albumHover.edgeX}% ${albumHover.edgeY}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 52%, rgba(0,0,0,0) 88%)`,
                      WebkitMaskImage: `radial-gradient(210px 120px at ${albumHover.edgeX}% ${albumHover.edgeY}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 52%, rgba(0,0,0,0) 88%)`,
                    }}
                  />
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {spotifyActive && showSpotifyPremiumAlert && !spotifyPremiumAlertDismissed ? (
            <motion.div
              className="relative z-20 mb-2 inline-flex w-fit cursor-pointer items-center gap-[8px] overflow-visible rounded-full px-[10px] py-[6px] text-[12px] font-medium text-[rgba(255,208,98,0.98)]"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 0.8, 0.26, 1] }}
              style={{
                backgroundColor: "rgba(40,40,40,0.45)",
                backgroundImage:
                  "linear-gradient(180deg, rgba(164,104,0,0.56) 0%, rgba(125,80,0,0.38) 52%, rgba(52,34,0,0.22) 100%)",
                backdropFilter: "blur(40px) saturate(1.8)",
                WebkitBackdropFilter: "blur(40px) saturate(1.8)",
                border: "1px solid rgba(255,208,98,0.34)",
                boxShadow:
                  "0 8px 24px rgba(0,0,0,0.22), inset 0 0.5px 0 rgba(255,255,255,0.1), inset 0 0 30px rgba(176,118,0,0.34)",
                pointerEvents: "auto",
              }}
              onMouseEnter={() => {
                if (spotifyPremiumAlertHoverLeaveTimerRef.current !== null) {
                  window.clearTimeout(spotifyPremiumAlertHoverLeaveTimerRef.current);
                  spotifyPremiumAlertHoverLeaveTimerRef.current = null;
                }
                setSpotifyPremiumAlertHover((prev) => ({ ...prev, active: true }));
              }}
              onMouseLeave={() => {
                if (spotifyPremiumAlertHoverLeaveTimerRef.current !== null) {
                  window.clearTimeout(spotifyPremiumAlertHoverLeaveTimerRef.current);
                }
                spotifyPremiumAlertHoverLeaveTimerRef.current = window.setTimeout(() => {
                  setSpotifyPremiumAlertHover((prev) => ({ ...prev, active: false }));
                  spotifyPremiumAlertHoverLeaveTimerRef.current = null;
                }, 140);
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const nx = (e.clientX - rect.left) / rect.width;
                const ny = (e.clientY - rect.top) / rect.height;
                const clampedX = Math.max(0, Math.min(1, nx));
                const clampedY = Math.max(0, Math.min(1, ny));
                setSpotifyPremiumAlertHover({
                  active: true,
                  x: clampedX * 100,
                  y: clampedY * 100,
                });
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSpotifyPremiumAlertDismissed(true);
                setSpotifyPremiumAlertTestVisible(false);
              }}
            >
              <motion.div
                className="pointer-events-none absolute inset-0"
                animate={{ opacity: spotifyPremiumAlertHover.active ? 0.5 : 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                style={{
                  background: `radial-gradient(260px 120px at ${spotifyPremiumAlertHover.x}% ${spotifyPremiumAlertHover.y}%, rgba(255,255,255,0.16), rgba(255,255,255,0.07) 42%, rgba(255,255,255,0.015) 64%, rgba(255,255,255,0) 82%), linear-gradient(135deg, rgba(255,255,255,0.018), rgba(255,255,255,0.012))`,
                  mixBlendMode: "color-dodge",
                  filter: "blur(7px) saturate(1.02) contrast(1.02)",
                }}
              />
              <div className="relative z-[1] inline-flex items-center gap-[8px]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-[16px] w-[16px] shrink-0"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM12 15C11.4477 15 11 15.4477 11 16C11 16.5523 11.4477 17 12 17C12.5523 17 13 16.5523 13 16C13 15.4477 12.5523 15 12 15ZM12 7C11.5858 7 11.25 7.33579 11.25 7.75V12.25C11.25 12.6642 11.5858 13 12 13C12.4142 13 12.75 12.6642 12.75 12.25V7.75C12.75 7.33579 12.4142 7 12 7Z"
                    fill="currentColor"
                  />
                </svg>
                <span>{SPOTIFY_PREMIUM_REQUIRED_ALERT}</span>
                <span
                  className="relative ml-[2px] inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center opacity-90"
                  aria-hidden="true"
                >
                  <span
                    className="absolute h-[1.5px] w-[12px] rounded-full"
                    style={{
                      backgroundColor: "rgba(255,208,98,0.98)",
                      transform: "rotate(45deg)",
                    }}
                  />
                  <span
                    className="absolute h-[1.5px] w-[12px] rounded-full"
                    style={{
                      backgroundColor: "rgba(255,208,98,0.98)",
                      transform: "rotate(-45deg)",
                    }}
                  />
                </span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {isMobile && spotifyConnectCta ? <div className="mb-2">{spotifyConnectCta}</div> : null}

        {/* ── Widget ───────────────────────────────────────────── */}
        <motion.div
          className="relative overflow-hidden flex flex-col items-center justify-center rounded-[24px] border border-white/[0.12] p-[16px]"
          animate={{
            y: spotifyEnabled && spotifyStatus === "connecting" ? 14 : 0,
          }}
          transition={{
            y: { type: "spring", stiffness: 210, damping: 20, mass: 0.85 },
          }}
          style={{
            width: playerWidth,
            zIndex: 1,
            backgroundColor: "rgba(40, 40, 40, 0.45)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.3), inset 0 0.5px 0 rgba(255,255,255,0.15)",
          }}
          onMouseDownCapture={triggerPlayerRipple}
          onMouseEnter={() => setPlayerHover((prev) => ({ ...prev, active: true }))}
          onMouseMove={handlePlayerPointerMove}
          onMouseLeave={() =>
            setPlayerHover((prev) => ({
              ...prev,
              active: false,
              edge: 0,
            }))
          }
        >
          {showIntroShimmer && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ x: "-120%", opacity: 0 }}
              animate={{ x: "120%", opacity: [0, 0.68, 0.34, 0] }}
              transition={{
                duration: 1.18,
                ease: [0.25, 0.85, 0.25, 1],
              }}
              style={{
                background:
                  "linear-gradient(100deg, rgba(255,255,255,0) 18%, rgba(255,255,255,0.58) 48%, rgba(255,255,255,0.2) 64%, rgba(255,255,255,0) 86%)",
                mixBlendMode: "screen",
                filter: "blur(7px)",
              }}
            />
          )}
          {spotifyPlayerPulseId > 0 && (
            <motion.div
              key={`player-sync-${spotifyPlayerPulseId}`}
              className="absolute inset-0 pointer-events-none"
              initial={{ x: "-120%", opacity: 0 }}
              animate={{ x: "120%", opacity: [0, 0.72, 0.3, 0] }}
              transition={{
                duration: 1.05,
                ease: [0.25, 0.85, 0.25, 1],
              }}
              style={{
                background:
                  "linear-gradient(100deg, rgba(255,255,255,0) 18%, rgba(255,255,255,0.58) 48%, rgba(255,255,255,0.2) 64%, rgba(255,255,255,0) 86%)",
                mixBlendMode: "screen",
                filter: "blur(7px)",
              }}
            />
          )}
          {/* Top row */}
          <div className="flex items-center justify-between gap-[8px] w-full">
            {/* Left slot: single flex item that contains balancer OR album art */}
            <motion.div
              className="shrink-0 h-[48px] relative overflow-hidden"
              animate={{
                width: artExpanded ? 24 : 48,
              }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              style={{ borderRadius: 8 }}
            >
              {/* Album art — fades out when expanded */}
              <motion.div
                className="absolute inset-0 cursor-pointer"
                animate={{
                  opacity: artExpanded ? 0 : 1,
                  scale: artExpanded ? 0.5 : 1,
                }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                onClick={() => {
                  if (artExpanded) {
                    playAlbumWhoosh("close");
                    setArtExpanded(false);
                    return;
                  }
                  playAlbumWhoosh("open");
                  setArtExpanded(true);
                }}
              >
                {isAutoFlippingCover && flipCoverPair ? (
                  <div
                    className="absolute inset-0"
                    style={{ perspective: 800, opacity: 1 }}
                  >
                    <motion.div
                      className="relative size-full"
                      key={`${flipCoverPair.front}-${flipCoverPair.back}`}
                      initial={{ rotateY: 0 }}
                      animate={{ rotateY: -180 }}
                      transition={{
                        duration: COVER_FLIP_DURATION_MS / 1000,
                        ease: [0.32, 0.72, 0, 1],
                      }}
                      style={{
                        transformStyle: "preserve-3d",
                        willChange: "transform",
                        transform: "translateZ(0)",
                      }}
                    >
                      <img
                        alt="Album art"
                        className="absolute inset-0 object-cover pointer-events-none size-full"
                        src={flipCoverPair.front}
                        style={{
                          borderRadius: 8,
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                          transform: "translateZ(0)",
                        }}
                      />
                      <img
                        alt="Next album art"
                        className="absolute inset-0 object-cover pointer-events-none size-full"
                        src={flipCoverPair.back}
                        style={{
                          borderRadius: 8,
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                          transform: "rotateY(-180deg) translateZ(0)",
                        }}
                      />
                    </motion.div>
                  </div>
                ) : (
                  <img
                    alt="Album art"
                    className="absolute inset-0 object-cover pointer-events-none size-full"
                    src={track.albumCover}
                    style={{ borderRadius: 8, opacity: 1 }}
                  />
                )}
              </motion.div>
            </motion.div>

            {/* Song info */}
            <motion.div
              className={`flex flex-col font-['Inter:Medium',sans-serif] font-medium min-w-0 not-italic overflow-hidden flex-[1_0_0] text-[14px] ${
                artExpanded
                  ? "items-center justify-center"
                  : "items-start justify-end"
              }`}
              animate={{
                x: artExpanded ? 0 : -4,
                paddingLeft: artExpanded ? 0 : 4,
              }}
              style={{
                transformOrigin: artExpanded ? "center center" : "left center",
              }}
              transition={{
                x: { duration: 0.28, ease: [0.32, 0.72, 0, 1] },
                paddingLeft: { duration: 0.28, ease: [0.32, 0.72, 0, 1] },
              }}
            >
              <motion.div
                className="inline-flex flex-col max-w-full"
                whileHover={{ scale: 0.95, opacity: 0.8 }}
                style={{
                  cursor: "pointer",
                  transformOrigin: artExpanded ? "center center" : "left center",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  openCurrentTrack();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    openCurrentTrack();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open ${track.title} by ${track.artist}`}
              >
                <ScrollingText
                  key={`title-${track.title}`}
                  className="text-white leading-[normal]"
                  center={artExpanded}
                  fullWidth={false}
                >
                  {track.title}
                </ScrollingText>
                <ScrollingText
                  key={`artist-${track.artist}`}
                  className="text-[rgba(255,255,255,0.6)] leading-[normal]"
                  center={artExpanded}
                  fullWidth={false}
                >
                  {track.artist}
                </ScrollingText>
              </motion.div>
            </motion.div>

            {/* Visualizer */}
            <div className="flex items-center justify-center shrink-0 size-[24px]">
              <div className="flex gap-[2px] items-center justify-center size-[24px]">
                {visualizerHeights.map((h, i) => (
                  <VisualizerBar
                    key={i}
                    height={h}
                  />
                ))}
              </div>
            </div>
          </div>

          <motion.div
            className="w-full overflow-hidden"
            animate={{
              opacity: showPlaybackControls ? 1 : 0,
              maxHeight: showPlaybackControls ? 84 : 0,
              marginTop: showPlaybackControls ? 16 : 0,
              y: showPlaybackControls ? 0 : -10,
              scaleY: showPlaybackControls ? 1 : 0.92,
            }}
            transition={{
              opacity: { duration: 0.26, ease: [0.2, 0.7, 0.2, 1] },
              maxHeight: { duration: 0.48, ease: [0.2, 0.72, 0.18, 1] },
              marginTop: { duration: 0.42, ease: [0.2, 0.72, 0.18, 1] },
              y: { type: "spring", stiffness: 190, damping: 14, mass: 0.82 },
              scaleY: { duration: 0.38, ease: [0.2, 0.72, 0.18, 1] },
            }}
            style={{ pointerEvents: showPlaybackControls ? "auto" : "none" }}
            onMouseEnter={() => setIsHoveringPlaybackControls(true)}
            onMouseLeave={() => setIsHoveringPlaybackControls(false)}
          >
            {/* Progress slider */}
            <div className="flex gap-[8px] items-center justify-center w-full mb-[16px]">
              <p
                className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic shrink-0 text-[10px] text-[rgba(255,255,255,0.55)]"
                style={{
                  fontVariantNumeric: "tabular-nums",
                  minWidth: "28px",
                  textAlign: "center",
                  filter: shouldObscureSpotifyTime ? "blur(3px)" : undefined,
                  opacity: shouldObscureSpotifyTime ? 0.6 : undefined,
                }}
              >
                {currentTimeLabel}
              </p>
              <div
                ref={sliderRef}
                className="flex flex-[1_0_0] items-center rounded-[100px] cursor-pointer relative"
                style={{
                  height: sliderStretch.height,
                  width: `calc(100% + ${sliderStretch.widthOffset}px)`,
                  transform: `translateX(${sliderStretch.xOffset}px)`,
                  cursor: isDragging ? "grabbing" : "grab",
                  transition: isDragging
                    ? "height 0.08s ease, width 0.08s ease, transform 0.08s ease"
                    : "height 0.15s ease, width 0.18s ease, transform 0.18s ease",
                }}
                onMouseEnter={() => setIsHoveringSlider(true)}
                onMouseLeave={() => {
                  if (!isDragging) setIsHoveringSlider(false);
                }}
                onMouseDown={(e) => {
                  setIsDragging(true);
                  draggedToEndRef.current = false;
                  scrubFromEvent(e.clientX);
                }}
              >
                <div
                  className="absolute inset-0 overflow-hidden rounded-[100px]"
                  style={{
                    backgroundColor: sliderActive
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(255,255,255,0.15)",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-[100px]"
                    style={{
                      transform: `scaleX(${progress})`,
                      transformOrigin: "left center",
                      backgroundColor: sliderActive
                        ? "rgba(255,255,255,0.65)"
                        : "rgba(217,217,217,0.4)",
                      transition: "background-color 0.15s ease",
                    }}
                  />
                </div>
              </div>
              <p
                className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic shrink-0 text-[10px] text-[rgba(255,255,255,0.55)]"
                style={{
                  fontVariantNumeric: "tabular-nums",
                  minWidth: "28px",
                  textAlign: "center",
                  filter: shouldObscureSpotifyTime ? "blur(3px)" : undefined,
                  opacity: shouldObscureSpotifyTime ? 0.6 : undefined,
                }}
              >
                {durationTimeLabel}
              </p>
            </div>

            {/* Controls row */}
            <div
              className="flex w-full items-center"
              style={{ pointerEvents: isDragging ? "none" : "auto" }}
            >
              <div className="w-[24px] shrink-0" />
              <div className="flex flex-1 items-center justify-center gap-[24px]">
                <button
                  className="flex items-center justify-center shrink-0 rounded-full p-[3px] transition-opacity hover:opacity-85 active:opacity-70 cursor-pointer"
                  aria-label="Previous track"
                  onClick={(e) => {
                    e.stopPropagation();
                    playUiClick("back");
                    goPrev();
                  }}
                >
                  <IconFastForward reversed />
                </button>
                <button
                  className="flex items-center justify-center shrink-0 rounded-full p-[3px] transition-opacity hover:opacity-85 active:opacity-70 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    playUiClick("soft");
                    togglePlayPause();
                  }}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <IconPause /> : <IconPlay />}
                </button>
                <button
                  className="flex items-center justify-center shrink-0 rounded-full p-[3px] transition-opacity hover:opacity-85 active:opacity-70 cursor-pointer"
                  aria-label="Next track"
                  onClick={(e) => {
                    e.stopPropagation();
                    playUiClick("forward");
                    advanceToNext("manual");
                  }}
                >
                  <IconFastForward />
                </button>
              </div>
              <div className="flex w-[24px] shrink-0 items-center justify-end">
                {spotifyActive && spotifyStatus === "ready" ? (
                  <div
                    aria-hidden
                    className="inline-flex items-center justify-center"
                  >
                    <SpotifyLogo
                      className="size-[22px]"
                      color="rgba(255,255,255,0.34)"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
          <motion.div
            className="absolute left-0 right-0 bottom-0 h-[2px] overflow-hidden pointer-events-none"
            animate={{
              opacity: showPlaybackControls ? 0 : 1,
              scaleX: showPlaybackControls ? 0.92 : 1,
            }}
            transition={{
              opacity: { duration: 0.14, ease: "easeOut" },
              scaleX: { duration: 0.2, ease: [0.22, 0.78, 0.22, 1] },
            }}
            >
              <div
                className="h-full w-full"
                style={{ backgroundColor: "rgba(255,255,255,0.16)" }}
              >
              <div
                className="h-full rounded-[100px]"
                style={{
                  transform: `scaleX(${progress})`,
                  transformOrigin: "left center",
                  backgroundColor: "rgba(255,255,255,0.56)",
                }}
              />
            </div>
          </motion.div>
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ opacity: playerHover.active ? 0.5 : 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            style={{
              background: `radial-gradient(260px 120px at ${playerHover.x}% ${playerHover.y}%, rgba(255,255,255,0.16), rgba(255,255,255,0.07) 42%, rgba(255,255,255,0.015) 64%, rgba(255,255,255,0) 82%), linear-gradient(135deg, rgba(255,255,255,0.018), rgba(255,255,255,0.012))`,
              mixBlendMode: "color-dodge",
              filter: "blur(7px) saturate(1.02) contrast(1.02)",
            }}
          />
          {playerRipple.id > 0 && (
            <motion.div
              key={playerRipple.id}
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0.35, scale: 0.2 }}
              animate={{ opacity: 0, scale: 1.75 }}
              transition={{ duration: 0.55, ease: [0.22, 0.8, 0.26, 1] }}
              style={{
                transformOrigin: `${playerRipple.x}% ${playerRipple.y}%`,
                background: `radial-gradient(150px 150px at ${playerRipple.x}% ${playerRipple.y}%, rgba(255,255,255,0.34), rgba(255,255,255,0.12) 36%, rgba(255,255,255,0) 74%)`,
                mixBlendMode: "screen",
                filter: "blur(4px)",
              }}
            />
          )}
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-[24px]"
            animate={{
              opacity: playerHover.active ? 0.06 + playerHover.edge * 0.32 : 0,
            }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow:
                "0 0 10px rgba(255,255,255,0.2), inset 0 0 5px rgba(255,255,255,0.1)",
              mixBlendMode: "screen",
              maskImage: `radial-gradient(140px 80px at ${playerHover.edgeX}% ${playerHover.edgeY}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 42%, rgba(0,0,0,0) 80%)`,
              WebkitMaskImage: `radial-gradient(140px 80px at ${playerHover.edgeX}% ${playerHover.edgeY}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 42%, rgba(0,0,0,0) 80%)`,
            }}
          />
        </motion.div>
        {!isMobile && spotifyConnectCta ? <div className="mt-2">{spotifyConnectCta}</div> : null}
      </motion.div>
    </div>
  );
}
