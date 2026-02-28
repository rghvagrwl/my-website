import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import svgPaths from "../../imports/svg-m4lwl8pe3p";
import svgPathsPlaying from "../../imports/svg-umafma3ph";

/* ── Playlist data ──────────────────────────────────────────────── */
interface Track {
  title: string;
  artist: string;
  albumCover: string;
  duration: number; // seconds
  songLink: string;
  previewUrl: string;
}

const PLAYLIST: Track[] = [
  {
    title: "Ivy",
    artist: "Frank Ocean",
    albumCover:
      "https://i.scdn.co/image/ab67616d0000b273c5649add07ed3720be9d5526",
    duration: 249,
    songLink: "https://open.spotify.com/track/2ZWlPOoWh0626oTaHrnl2a",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/13/96/7b/13967b49-a146-56f5-5365-7f621548c866/mzaf_11242378811991419158.plus.aac.p.m4a",
  },
  {
    title: "EARFQUAKE",
    artist: "Tyler, The Creator",
    albumCover:
      "https://i.scdn.co/image/ab67616d0000b27330a635de2bb0caa4e26f6abb",
    duration: 190,
    songLink: "https://open.spotify.com/track/5hVghJ4KaYES3BFUATCYn0",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/76/97/e0/7697e041-c77c-ec17-c79e-4d562760d92f/mzaf_10258663076190219930.plus.aac.p.m4a",
  },
  {
    title: "Passionfruit",
    artist: "Drake",
    albumCover:
      "https://i.scdn.co/image/ab67616d0000b2734f0fd9dad63977146e685700",
    duration: 298,
    songLink: "https://open.spotify.com/track/5mCPDVBb16L4XQwDdbRUpz",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/80/52/4c/80524ced-b13d-b8f2-abee-a1b893d36917/mzaf_14069081156207436910.plus.aac.p.m4a",
  },
  {
    title: "Bad Habit",
    artist: "Steve Lacy",
    albumCover:
      "https://i.scdn.co/image/ab67616d0000b2736938311000a0e494a26986e5",
    duration: 232,
    songLink: "https://open.spotify.com/track/4k6Uh1HXdhtusDW5y8Gbvy",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/89/13/26/891326e9-9ab2-0502-7617-2c7302f298ef/mzaf_8212723656460773117.plus.aac.p.m4a",
  },
  {
    title: "Sweet Boy",
    artist: "Malcolm Todd",
    albumCover:
      "https://i.scdn.co/image/ab67616d0000b2732c1f34ecc1929fb59908aad1",
    duration: 200,
    songLink: "https://open.spotify.com/track/59c2xv2kMzYM6HR9oY6BIa",
    previewUrl:
      "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/06/c2/32/06c232f9-55b4-8ca4-c5a3-5a62cdab0aa3/mzaf_545468144646643051.plus.aac.p.m4a",
  },
];

const SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 1,
} as const;

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
      transition={{ duration: 0.12, ease: "easeOut" }}
    />
  );
}

/* ── Auto-scrolling marquee text with edge fade ─────────────────── */
function ScrollingText({
  children,
  className = "",
  center = false,
}: {
  children: string;
  className?: string;
  center?: boolean;
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

  useEffect(() => {
    const t = setTimeout(measure, 50);
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      clearTimeout(t);
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
  }, [shouldScroll, center]);

  // Determine mask: left fade only when actively scrolling, right fade always when scrollable
  const getMask = () => {
    if (!shouldScroll) return undefined;
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
      className={`relative overflow-hidden w-full ${
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
        {shouldScroll && <span aria-hidden>{children}</span>}
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

/* ── Helpers ─────────────────────────────────────────────────────── */
const VISUALIZER_MIN_HEIGHT = 4;
const VISUALIZER_MAX_HEIGHT = 16;
const VISUALIZER_BAR_COUNT = 6;
const DEFAULT_VISUALIZER_HEIGHTS = Array.from(
  { length: VISUALIZER_BAR_COUNT },
  () => VISUALIZER_MIN_HEIGHT
);
const CONNECT_TRANSITION_MS = 450;
const QUICK_RECONNECT_MS = 160;
const AUTH_STORAGE_KEY = "audio-player:authenticated";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function readAuthState() {
  if (typeof window === "undefined") return false;

  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeAuthState(value: boolean) {
  if (typeof window === "undefined") return;

  try {
    if (value) {
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
      return;
    }

    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Keep connect flow silent if storage access fails.
  }
}

/* ── Main component ─────────────────────────────────────────────── */
export default function DynamicIsland() {
  const [trackIndex, setTrackIndex] = useState(0);
  const track = PLAYLIST[trackIndex];

  const [isPlaying, setIsPlaying] = useState(false);
  const [artExpanded, setArtExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(track.duration);
  const [visualizerHeights, setVisualizerHeights] = useState<number[]>(
    () => [...DEFAULT_VISUALIZER_HEIGHTS]
  );
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    () => (readAuthState() ? "connected" : "disconnected")
  );

  // Slider scrubbing state
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringSlider, setIsHoveringSlider] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array | null>(null);
  const visualizerFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(isPlaying);

  const effectiveDuration = Number.isFinite(trackDuration) && trackDuration > 0
    ? trackDuration
    : track.duration;
  const progress = effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;

  const stopVisualizer = useCallback(() => {
    if (visualizerFrameRef.current !== null) {
      cancelAnimationFrame(visualizerFrameRef.current);
      visualizerFrameRef.current = null;
    }
  }, []);

  const resetVisualizer = useCallback(() => {
    setVisualizerHeights([...DEFAULT_VISUALIZER_HEIGHTS]);
  }, []);

  const ensureAudioGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;

    const AudioContextCtor =
      window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return false;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    const context = audioContextRef.current;
    if (context.state === "suspended") {
      await context.resume();
    }

    if (!analyserRef.current) {
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      analyserRef.current = analyser;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    }

    if (!sourceRef.current) {
      const source = context.createMediaElementSource(audio);
      source.connect(analyserRef.current);
      analyserRef.current.connect(context.destination);
      sourceRef.current = source;
    }

    return true;
  }, []);

  const playAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      await ensureAudioGraph();
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [ensureAudioGraph]);

  const pauseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const scrubFromEvent = useCallback(
    (clientX: number) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      const nextTime = Math.round(ratio * effectiveDuration);
      setCurrentTime(nextTime);
      if (audioRef.current) {
        audioRef.current.currentTime = nextTime;
      }
    },
    [effectiveDuration]
  );

  // Global mouse handlers for slider dragging
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => scrubFromEvent(e.clientX);
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, scrubFromEvent]);

  const goNext = useCallback(() => {
    setTrackIndex((i) => (i + 1) % PLAYLIST.length);
    setCurrentTime(0);
  }, []);

  const goPrev = useCallback(() => {
    // If more than 3s in, restart current track; otherwise go to previous
    if (currentTime > 3) {
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    } else {
      setTrackIndex((i) => (i - 1 + PLAYLIST.length) % PLAYLIST.length);
      setCurrentTime(0);
    }
  }, [currentTime]);

  useEffect(() => {
    setCurrentTime(0);
    setTrackDuration(track.duration);
    resetVisualizer();

    if (isPlayingRef.current) {
      void playAudio();
    }
  }, [trackIndex, track.duration, playAudio, resetVisualizer]);

  useEffect(() => {
    if (!isPlaying) {
      stopVisualizer();
      resetVisualizer();
      return;
    }

    const analyser = analyserRef.current;
    const frequencyData = frequencyDataRef.current;
    if (!analyser || !frequencyData) return;

    const updateVisualizer = () => {
      analyser.getByteFrequencyData(frequencyData);
      const binsPerBar = Math.max(
        1,
        Math.floor(frequencyData.length / VISUALIZER_BAR_COUNT)
      );

      const rawHeights = Array.from({ length: VISUALIZER_BAR_COUNT }, (_, i) => {
        const start = i * binsPerBar;
        const end = Math.min(frequencyData.length, start + binsPerBar);

        let sum = 0;
        for (let j = start; j < end; j += 1) {
          sum += frequencyData[j];
        }

        const avg = end > start ? sum / (end - start) : 0;
        const normalized = Math.pow(avg / 255, 0.85);
        return (
          VISUALIZER_MIN_HEIGHT +
          normalized * (VISUALIZER_MAX_HEIGHT - VISUALIZER_MIN_HEIGHT)
        );
      });

      setVisualizerHeights((prev) =>
        prev.map((height, i) => height * 0.6 + rawHeights[i] * 0.4)
      );

      visualizerFrameRef.current = requestAnimationFrame(updateVisualizer);
    };

    visualizerFrameRef.current = requestAnimationFrame(updateVisualizer);
    return stopVisualizer;
  }, [isPlaying, resetVisualizer, stopVisualizer]);

  useEffect(() => {
    return () => {
      stopVisualizer();
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      void audioContextRef.current?.close();
    };
  }, [stopVisualizer]);

  const sliderActive = isDragging || isHoveringSlider;
  const isConnecting = connectionStatus === "connecting";
  const isConnected = connectionStatus === "connected";

  const handleConnect = useCallback(async () => {
    if (isConnecting || isConnected) return;

    setConnectionStatus("connecting");

    try {
      const hasStoredAuth = readAuthState();
      const delay = hasStoredAuth ? QUICK_RECONNECT_MS : CONNECT_TRANSITION_MS;
      await new Promise((resolve) => setTimeout(resolve, delay));

      writeAuthState(true);
      setConnectionStatus("connected");
    } catch {
      // Suppress disruptive alerts/toasts for connect failures.
      setConnectionStatus("disconnected");
    }
  }, [isConnecting, isConnected]);

  return (
    <div
      className="flex items-end justify-center min-h-screen relative overflow-hidden pb-[48px]"
      style={{ backgroundColor: artExpanded ? "#000" : "#f7f7f7", transition: "background-color 0.6s ease" }}
    >
      <audio
        ref={audioRef}
        src={track.previewUrl}
        crossOrigin="anonymous"
        preload="auto"
        className="hidden"
        onTimeUpdate={() => {
          if (!isDragging && audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (!audioRef.current) return;
          const nextDuration =
            Number.isFinite(audioRef.current.duration) &&
            audioRef.current.duration > 0
              ? audioRef.current.duration
              : track.duration;
          setTrackDuration(nextDuration);
        }}
        onEnded={() => {
          goNext();
        }}
      />

      {/* ── Full-screen blurred album background ──────────────── */}
      <AnimatePresence mode="popLayout">
        {artExpanded && (
          <motion.img
            key={track.albumCover}
            src={track.albumCover}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{
              filter: "blur(120px) brightness(0.45) saturate(1.6)",
              transform: "scale(1.95)",
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="flex flex-col items-center relative z-10"
        layout
        transition={SPRING}
      >
        {/* ── Large album art above widget ──────────────────────── */}
        <AnimatePresence>
          {artExpanded && (
            <motion.div
              key="album-large-wrapper"
              initial={{ height: 0, marginBottom: 0 }}
              animate={{ height: 320, marginBottom: 16 }}
              exit={{ height: 0, marginBottom: 0 }}
              transition={SPRING}
              className="relative w-[320px]"
              style={{ zIndex: 0 }}
            >
              <motion.div
                key="album-large-content"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={SPRING}
                className="absolute inset-0 cursor-pointer"
                onClick={() => setArtExpanded(false)}
              >
                {/* Sharp album art */}
                <div className="relative rounded-[24px] size-[320px] overflow-hidden">
                  <img
                    alt="Album art"
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    src={track.albumCover}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Widget ───────────────────────────────────────────── */}
        <div
          className="flex flex-col gap-[16px] items-center justify-center p-[16px] rounded-[24px] w-[332px] border border-white/[0.12]"
          style={{
            zIndex: 1,
            backgroundColor: "rgba(40, 40, 40, 0.45)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.3), inset 0 0.5px 0 rgba(255,255,255,0.15)",
          }}
        >
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
                  if (!artExpanded) setArtExpanded(true);
                }}
              >
                <img
                  alt="Album art"
                  className="absolute inset-0 object-cover pointer-events-none size-full"
                  src={track.albumCover}
                  style={{ borderRadius: 8 }}
                />
              </motion.div>
            </motion.div>

            {/* Song info */}
            <div
              className={`flex flex-col font-['Inter:Medium',sans-serif] font-medium min-w-0 not-italic overflow-hidden flex-[1_0_0] text-[14px] ${
                artExpanded
                  ? "items-center justify-center"
                  : "items-start justify-end"
              }`}
            >
              <ScrollingText
                className="text-white leading-[normal]"
                center={artExpanded}
              >
                {track.title}
              </ScrollingText>
              <ScrollingText
                className="text-[rgba(255,255,255,0.6)] leading-[normal]"
                center={artExpanded}
              >
                {track.artist}
              </ScrollingText>
            </div>

            {/* Visualizer */}
            <div className="flex items-center justify-center shrink-0 size-[24px]">
              <div className="flex gap-[2px] items-center justify-center size-[24px]">
                {visualizerHeights.map((height, i) => (
                  <VisualizerBar key={i} height={height} />
                ))}
              </div>
            </div>
          </div>

          {/* Progress slider */}
          <div className="flex gap-[8px] items-center justify-center w-full">
            <p
              className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic shrink-0 text-[10px] text-[rgba(255,255,255,0.55)]"
              style={{ fontVariantNumeric: "tabular-nums", minWidth: "28px", textAlign: "center" }}
            >
              {formatTime(currentTime)}
            </p>
            <div
              ref={sliderRef}
              className="flex flex-[1_0_0] items-center rounded-[100px] cursor-pointer relative"
              style={{
                height: isDragging ? 10 : 6,
                transition: "height 0.15s ease",
              }}
              onMouseEnter={() => setIsHoveringSlider(true)}
              onMouseLeave={() => {
                if (!isDragging) setIsHoveringSlider(false);
              }}
              onMouseDown={(e) => {
                setIsDragging(true);
                scrubFromEvent(e.clientX);
              }}
            >
              <div
                className="h-full shrink-0 rounded-l-[100px]"
                style={{
                  width: `${progress * 100}%`,
                  backgroundColor: sliderActive
                    ? "rgba(255,255,255,0.65)"
                    : "rgba(217,217,217,0.4)",
                  transition: "background-color 0.15s ease",
                }}
              />
              <div
                className="h-full flex-1 rounded-r-[100px]"
                style={{
                  backgroundColor: sliderActive
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(255,255,255,0.15)",
                  transition: "background-color 0.15s ease",
                }}
              />
            </div>
            <p
              className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic shrink-0 text-[10px] text-[rgba(255,255,255,0.55)]"
              style={{ fontVariantNumeric: "tabular-nums", minWidth: "28px", textAlign: "center" }}
            >
              {formatTime(effectiveDuration)}
            </p>
          </div>

          {/* Controls row */}
          <div className="flex gap-[24px] items-center">
            <button
              className="flex items-center justify-center shrink-0 hover:scale-90 transition-transform active:scale-80"
              aria-label="Previous track"
              onClick={goPrev}
            >
              <IconFastForward reversed />
            </button>
            <button
              className="flex items-center justify-center shrink-0 hover:scale-90 transition-transform active:scale-80"
              onClick={() => {
                if (isPlaying) {
                  pauseAudio();
                  return;
                }
                void playAudio();
              }}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <IconPause /> : <IconPlay />}
            </button>
            <button
              className="flex items-center justify-center shrink-0 hover:scale-90 transition-transform active:scale-80"
              aria-label="Next track"
              onClick={goNext}
            >
              <IconFastForward />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleConnect()}
            disabled={isConnecting || isConnected}
            className={`h-[30px] px-[12px] rounded-[999px] flex items-center gap-[8px] font-['Inter:Medium',sans-serif] text-[12px] transition-all duration-300 ${
              isConnected
                ? "bg-white text-black"
                : "bg-white/[0.1] text-white hover:bg-white/[0.18]"
            } ${isConnecting ? "cursor-wait opacity-80" : ""}`}
          >
            <span
              className={`size-[6px] rounded-full transition-all duration-300 ${
                isConnected ? "bg-[#1DB954]" : "bg-white/60"
              } ${isConnecting ? "animate-pulse" : ""}`}
            />
            {isConnected
              ? "Connected"
              : isConnecting
                ? "Connecting..."
                : "Connect"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
