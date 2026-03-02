import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SESSION_PLAYLIST, type PlaylistTrack } from "../data/playlist";

const DESKTOP = {
  columns: 14,
  cellW: 270,
  cellH: 232,
  cover: 124,
  cardH: 188,
  revealY: 124,
  xOffset: 62,
  yOffset: 30,
  hoverLift: 12,
};
const MOBILE = {
  columns: 14,
  cellW: 158,
  cellH: 164,
  cover: 92,
  cardH: 142,
  revealY: 94,
  xOffset: 38,
  yOffset: 18,
  hoverLift: 8,
};
const COVER_ROTATE_MAX = 4;
const POP_IN_DURATION_S = 0.74;
let hasPlayedMusicLoadAnimation = false;

function wrap(value: number, size: number): number {
  const half = size / 2;
  return ((((value + half) % size) + size) % size) - half;
}

const DRAG_SENSITIVITY = 0.74;
const WHEEL_SENSITIVITY = 0.62;
const INERTIA_DAMPING_BASE = 0.8;
const DRAG_CLICK_SLOP_PX = 6;

function seededNoise(i: number): number {
  const raw = Math.sin((i + 1) * 91.127) * 43758.5453123;
  return raw - Math.floor(raw);
}

function HoverMarquee({
  text,
  className,
  threshold,
  width,
  active,
}: {
  text: string;
  className: string;
  threshold: number;
  width: number;
  active: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLSpanElement>(null);
  const cycleTimerRef = useRef<number | null>(null);
  const pauseTimerRef = useRef<number | null>(null);
  const shiftRef = useRef(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const GAP = 16;
  const SPEED = 24; // px/s
  const PAUSE_MS = 5000;
  const shouldScroll = text.length > threshold;

  const clearTimers = useCallback(() => {
    if (cycleTimerRef.current !== null) {
      window.clearTimeout(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  const setTrackX = useCallback((x: number) => {
    if (!trackRef.current) return;
    trackRef.current.style.transform = `translateX(${x}px)`;
  }, []);

  useLayoutEffect(() => {
    if (!containerRef.current || !primaryRef.current) return;
    const cw = containerRef.current.clientWidth;
    const tw = primaryRef.current.scrollWidth;
    shiftRef.current = tw + GAP;
    if (tw <= cw + 2) shiftRef.current = 0;
  }, [text, width]);

  useEffect(() => {
    if (!trackRef.current) return;
    clearTimers();
    trackRef.current.style.transition = "none";
    setTrackX(0);
    setIsScrolling(false);

    if (!active || !shouldScroll || shiftRef.current <= 2) return;

    const run = () => {
      if (!trackRef.current) return;
      const shift = shiftRef.current;
      const durationSec = Math.max(2.8, shift / SPEED);
      setIsScrolling(true);
      trackRef.current.style.transition = `transform ${durationSec}s linear`;
      requestAnimationFrame(() => setTrackX(-shift));

      cycleTimerRef.current = window.setTimeout(() => {
        if (!trackRef.current) return;
        trackRef.current.style.transition = "none";
        setTrackX(-shift);
        setIsScrolling(false);
        pauseTimerRef.current = window.setTimeout(() => {
          if (!trackRef.current) return;
          trackRef.current.style.transition = "none";
          setTrackX(0);
          requestAnimationFrame(run);
        }, PAUSE_MS);
      }, durationSec * 1000 + 20);
    };

    pauseTimerRef.current = window.setTimeout(run, PAUSE_MS);
    return () => {
      clearTimers();
      setIsScrolling(false);
      if (trackRef.current) trackRef.current.style.transition = "none";
      setTrackX(0);
    };
  }, [active, clearTimers, setTrackX, shouldScroll, text]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{
        width,
        maskImage: shouldScroll
          ? isScrolling
            ? "linear-gradient(to right, transparent 0, black 10px, black calc(100% - 10px), transparent 100%)"
            : "linear-gradient(to right, black 0, black calc(100% - 10px), transparent 100%)"
          : undefined,
        WebkitMaskImage: shouldScroll
          ? isScrolling
            ? "linear-gradient(to right, transparent 0, black 10px, black calc(100% - 10px), transparent 100%)"
            : "linear-gradient(to right, black 0, black calc(100% - 10px), transparent 100%)"
          : undefined,
      }}
    >
      <div
        ref={trackRef}
        className={`inline-flex whitespace-nowrap ${shouldScroll ? "will-change-transform" : "w-full justify-center"}`}
      >
        <span ref={primaryRef} className={className}>
          {text}
        </span>
        {shouldScroll && (
          <span className={className} style={{ paddingLeft: 16 }}>
            {text}
          </span>
        )}
      </div>
    </div>
  );
}

type Track = PlaylistTrack;
type CardMeta = {
  track: Track;
  i: number;
  id: string;
  x: number;
  y: number;
  delay: number;
  tilt: number;
};

const MusicCard = memo(function MusicCard({
  card,
  setRef,
  playLoadInAnimation,
  coverSize,
  cardHeight,
  revealY,
  hoverLift,
  titleClassName,
  artistClassName,
  disableTrackLinks,
  onTrackSelect,
  playlistLength,
}: {
  card: CardMeta;
  setRef: (el: HTMLAnchorElement | null) => void;
  playLoadInAnimation: boolean;
  coverSize: number;
  cardHeight: number;
  revealY: number;
  hoverLift: number;
  titleClassName: string;
  artistClassName: string;
  disableTrackLinks?: boolean;
  onTrackSelect?: (trackIndex: number) => void;
  playlistLength: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isRevealReady, setIsRevealReady] = useState(!playLoadInAnimation);
  const revealReadyTimerRef = useRef<number | null>(null);
  const showMeta = isRevealReady && isHovered;

  useEffect(
    () => () => {
      if (revealReadyTimerRef.current !== null) {
        window.clearTimeout(revealReadyTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!playLoadInAnimation) {
      setIsRevealReady(true);
      return;
    }
    setIsRevealReady(false);
    if (revealReadyTimerRef.current !== null) {
      window.clearTimeout(revealReadyTimerRef.current);
    }
    revealReadyTimerRef.current = window.setTimeout(() => {
      setIsRevealReady(true);
      revealReadyTimerRef.current = null;
    }, (card.delay + POP_IN_DURATION_S) * 1000);
  }, [card.delay, playLoadInAnimation]);

  return (
    <a
      ref={setRef}
      href={disableTrackLinks ? undefined : card.track.songLink}
      target={disableTrackLinks ? undefined : "_blank"}
      rel={disableTrackLinks ? undefined : "noreferrer"}
      className={`absolute ${disableTrackLinks ? "cursor-pointer" : "cursor-inherit"}`}
      style={{
        width: coverSize,
        height: cardHeight,
        transform: `translate3d(${card.x}px, ${card.y}px, 0)`,
        contain: "layout style",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => {
        setIsHovered(false);
      }}
      onClick={(e) => {
        if (!isRevealReady) {
          e.preventDefault();
          return;
        }
        if (disableTrackLinks && onTrackSelect && playlistLength > 0) {
          e.preventDefault();
          onTrackSelect(card.i);
        }
      }}
    >
      <div
        className="relative"
        style={{
          opacity: playLoadInAnimation ? 0 : 1,
          animationName: playLoadInAnimation ? "musicCanvasCoverPopIn" : "none",
          animationDuration: playLoadInAnimation
            ? `${POP_IN_DURATION_S}s`
            : undefined,
          animationTimingFunction: playLoadInAnimation
            ? "cubic-bezier(0.18, 0.88, 0.24, 1.2)"
            : undefined,
          animationDelay: playLoadInAnimation
            ? `${card.delay.toFixed(3)}s`
            : undefined,
          animationFillMode: playLoadInAnimation ? "both" : undefined,
        }}
      >
        <div
          className="relative overflow-hidden rounded-[1px] transition-transform duration-620 ease-[cubic-bezier(0.2,0.72,0.2,1)]"
          style={{
            width: coverSize,
            height: coverSize,
            transform: `translateY(${showMeta ? -hoverLift : 0}px) rotate(${showMeta ? 0 : card.tilt}deg) scale(${showMeta ? 0.9 : 1})`,
            transformOrigin: "center center",
            backgroundColor: "rgba(30,30,30,0.12)",
            border: "0.5px solid rgba(0,0,0,0.05)",
          }}
        >
          <img
            src={card.track.albumCover}
            alt={`${card.track.title} cover`}
            className="h-full w-full object-cover transition-[filter] duration-320 ease-[cubic-bezier(0.2,0.72,0.2,1)]"
            draggable={false}
            loading="lazy"
            decoding="async"
            style={{ filter: showMeta ? "blur(0.8px)" : "blur(0px)" }}
          />
          <div
            className="absolute inset-0 transition-opacity duration-280"
            style={{ backgroundColor: "#E6EBF5", opacity: isHovered ? 0.5 : 0 }}
          />
        </div>
      </div>
      <div
        className="pointer-events-none absolute left-0 transition-all duration-420 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{
          width: coverSize,
          top: revealY,
          opacity: showMeta ? 1 : 0,
          transform: `translateY(${showMeta ? 0 : 8}px)`,
        }}
      >
        {showMeta ? (
          <>
            <HoverMarquee
              text={card.track.title}
              className={titleClassName}
              threshold={16}
              width={coverSize}
              active
            />
            <HoverMarquee
              text={card.track.artist}
              className={artistClassName}
              threshold={20}
              width={coverSize}
              active
            />
          </>
        ) : null}
      </div>
    </a>
  );
});

export default function MusicCanvas({
  playlist,
  disableTrackLinks = false,
  onTrackSelect,
}: {
  playlist: PlaylistTrack[];
  disableTrackLinks?: boolean;
  onTrackSelect?: (trackIndex: number) => void;
}) {
  const [playLoadInAnimation] = useState(() => !hasPlayedMusicLoadAnimation);
  useEffect(() => {
    if (!hasPlayedMusicLoadAnimation) {
      hasPlayedMusicLoadAnimation = true;
    }
  }, []);

  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = viewportWidth < 768;
  const tracks = playlist.length > 0 ? playlist : SESSION_PLAYLIST;
  const layout = isMobile ? MOBILE : DESKTOP;
  const columns = Math.max(1, Math.min(layout.columns, tracks.length));
  const displayCount = tracks.length;
  const rows = Math.max(1, Math.ceil(displayCount / columns));
  const worldW = columns * layout.cellW;
  const worldH = rows * layout.cellH;

  const offsetRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const velocityRef = useRef({ x: 0, y: 0 });
  const inertiaRafRef = useRef<number | null>(null);
  const inertiaLastTsRef = useRef<number | null>(null);
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const dragRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    lastTs: 0,
    moved: false,
  });
  const suppressClickUntilRef = useRef(0);

  const stopInertia = useCallback(() => {
    if (inertiaRafRef.current !== null) {
      cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    inertiaLastTsRef.current = null;
  }, []);

  const titleClassName = isMobile
    ? "text-[12px] leading-[1.1] tracking-[-0.01em] text-[#1E1E1E]"
    : "text-[14px] leading-[1.1] tracking-[-0.01em] text-[#1E1E1E]";
  const artistClassName = isMobile
    ? "text-[12px] leading-[1.2] text-[rgba(30,30,30,0.5)]"
    : "text-[14px] leading-[1.2] text-[rgba(30,30,30,0.5)]";

  const cardMeta: CardMeta[] = useMemo(
    () =>
      Array.from({ length: displayCount }, (_, i) => {
        const track = tracks[i];
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = col * layout.cellW - worldW / 2 + layout.xOffset;
        const y = row * layout.cellH - worldH / 2 + layout.yOffset;
        const delay = 0.14 + row * 0.072 + col * 0.042;

        return {
          track,
          i,
          id: `card-${track.slug}-${i}`,
          x,
          y,
          delay,
          tilt: seededNoise(i + 17) * COVER_ROTATE_MAX * 2 - COVER_ROTATE_MAX,
        };
      }),
    [
      displayCount,
      columns,
      layout.cellH,
      layout.cellW,
      layout.xOffset,
      layout.yOffset,
      tracks,
      worldH,
      worldW,
    ]
  );
  const flushTransforms = useCallback(() => {
    frameRef.current = null;
    const ox = offsetRef.current.x;
    const oy = offsetRef.current.y;
    const xWrapOffset = layout.cover * 0.5;
    const yWrapOffset = layout.cardH * 0.5;

    for (let i = 0; i < cardMeta.length; i += 1) {
      const el = cardRefs.current[i];
      if (!el) continue;
      const card = cardMeta[i];
      const x = wrap(card.x + ox + xWrapOffset, worldW) - xWrapOffset;
      const y = wrap(card.y + oy + yWrapOffset, worldH) - yWrapOffset;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }, [cardMeta, layout.cardH, layout.cover, worldH, worldW]);

  const requestTransformFlush = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(flushTransforms);
  }, [flushTransforms]);

  const updateOffset = useCallback(
    (dx: number, dy: number) => {
      offsetRef.current.x = wrap(offsetRef.current.x + dx, worldW);
      offsetRef.current.y = wrap(offsetRef.current.y + dy, worldH);
      requestTransformFlush();
    },
    [requestTransformFlush, worldH, worldW]
  );

  const startInertia = useCallback(() => {
    stopInertia();

    const step = (ts: number) => {
      const prevTs = inertiaLastTsRef.current ?? ts;
      const dt = Math.max(8, Math.min(34, ts - prevTs));
      const frameScale = dt / 16.666;
      inertiaLastTsRef.current = ts;

      const v = velocityRef.current;
      if (Math.abs(v.x) < 0.12 && Math.abs(v.y) < 0.12) {
        v.x = 0;
        v.y = 0;
        stopInertia();
        return;
      }

      updateOffset(v.x * frameScale, v.y * frameScale);
      const damping = Math.pow(INERTIA_DAMPING_BASE, frameScale);
      v.x *= damping;
      v.y *= damping;

      inertiaRafRef.current = requestAnimationFrame(step);
    };

    inertiaRafRef.current = requestAnimationFrame(step);
  }, [stopInertia, updateOffset]);

  useEffect(() => {
    requestTransformFlush();
    return () => stopInertia();
  }, [requestTransformFlush, stopInertia]);

  return (
    <section
      className="absolute inset-0 overflow-hidden select-none"
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onWheel={(e) => {
        e.preventDefault();
        stopInertia();
        const unit =
          e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
        updateOffset(
          -e.deltaX * unit * WHEEL_SENSITIVITY,
          -e.deltaY * unit * WHEEL_SENSITIVITY
        );
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        stopInertia();
        velocityRef.current.x = 0;
        velocityRef.current.y = 0;
        dragRef.current.active = true;
        dragRef.current.moved = false;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        dragRef.current.lastTs = e.timeStamp;
        setIsDragging(false);
      }}
      onPointerMove={(e) => {
        if (!dragRef.current.active) return;
        const totalDx = e.clientX - dragRef.current.startX;
        const totalDy = e.clientY - dragRef.current.startY;
        if (!dragRef.current.moved && Math.hypot(totalDx, totalDy) > DRAG_CLICK_SLOP_PX) {
          dragRef.current.moved = true;
          setIsDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (!dragRef.current.moved) return;

        const prevTs = dragRef.current.lastTs || e.timeStamp;
        const dt = Math.max(8, Math.min(32, e.timeStamp - prevTs));
        const dx = e.clientX - dragRef.current.lastX;
        const dy = e.clientY - dragRef.current.lastY;
        if (dx === 0 && dy === 0) return;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        dragRef.current.lastTs = e.timeStamp;
        const frameScale = 16.666 / dt;
        const vX = dx * frameScale;
        const vY = dy * frameScale;
        velocityRef.current.x = velocityRef.current.x * 0.72 + vX * 0.28;
        velocityRef.current.y = velocityRef.current.y * 0.72 + vY * 0.28;
        updateOffset(dx * DRAG_SENSITIVITY, dy * DRAG_SENSITIVITY);
      }}
      onPointerUp={(e) => {
        if (!dragRef.current.active) return;
        dragRef.current.active = false;
        if (dragRef.current.moved) {
          suppressClickUntilRef.current = performance.now() + 160;
          velocityRef.current.x *= 0.8;
          velocityRef.current.y *= 0.8;
          startInertia();
        } else {
          velocityRef.current.x = 0;
          velocityRef.current.y = 0;
        }
        setIsDragging(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      onPointerCancel={() => {
        dragRef.current.active = false;
        velocityRef.current.x = 0;
        velocityRef.current.y = 0;
        stopInertia();
        setIsDragging(false);
      }}
      onClickCapture={(e) => {
        if (performance.now() < suppressClickUntilRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(1400px 800px at 50% 38%, rgba(255,255,255,0.52), rgba(255,255,255,0))",
        }}
      />

      <div
        className="absolute left-1/2 top-1/2"
        style={{ pointerEvents: isDragging ? "none" : "auto" }}
      >
        {cardMeta.map((card, i) => (
          <MusicCard
            key={card.id}
            card={card}
            playLoadInAnimation={playLoadInAnimation}
            coverSize={layout.cover}
            cardHeight={layout.cardH}
            revealY={layout.revealY}
            hoverLift={layout.hoverLift}
            titleClassName={titleClassName}
            artistClassName={artistClassName}
            disableTrackLinks={disableTrackLinks}
            onTrackSelect={onTrackSelect}
            playlistLength={tracks.length}
            setRef={(el) => {
              cardRefs.current[i] = el;
            }}
          />
        ))}
      </div>
    </section>
  );
}
