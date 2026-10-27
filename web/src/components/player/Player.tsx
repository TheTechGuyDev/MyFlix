"use client";

import Hls, { type Level } from "hls.js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { episodesFor, img, type Title } from "@/lib/catalog";
import { readProgress, writeProgress } from "@/lib/library";
import { PLAN_MAX_HEIGHT } from "@/lib/streams";
import { addUsage, logActivity, thisMonth, watchedTodayMinutes } from "@/lib/extras";
import { Spinner } from "@/components/auth/ui";
import { claim, deviceName, release, stopStream, type LiveStream } from "@/lib/live";
import { siteSettings } from "@/lib/site-settings";
import { useT } from "@/lib/i18n";

type Props = {
  title: Title;
  sources: string[];
  extraSubs?: { label: string; src: string; lang: string }[];
  intro?: { start: number; end: number };
  season: number;
  episode: number;
  profileId: string;
  planId: string;
  prefs: { autoplayNext: boolean; dataUsage: "auto" | "saver" | "hd" | "4k"; subtitleSize: "small" | "medium" | "large"; subtitleBg: "none" | "shadow" | "box"; dailyLimitMinutes?: number; monthlyDataCapGB?: number };
  startAt?: number;
  email: string;
  profileName: string;
  /** Smart TV app: handle exit / episode changes in-page instead of routing. */
  onExit?: () => void;
  onEpisode?: (season: number, episode: number) => void;
};

type Track = { id: number; label: string };
type Panel = null | "episodes" | "audio" | "speed" | "quality" | "sleep" | "cast";
const CAST_DEVICES = ["Living Room TV", "Bedroom Chromecast", "Samsung Smart TV (MyFlix app)"];

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];
const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return h ? `${h}:${m.toString().padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};
const qualityLabel = (h: number) => (h >= 2160 ? "4K" : h >= 1440 ? "1440p" : `${h}p`);

export default function Player({ title, sources, extraSubs = [], intro, season, episode, profileId, planId, prefs, startAt, email, profileName, onExit, onEpisode }: Props) {
  const router = useRouter();
  const tx = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSave = useRef(0);

  const isSeries = title.type === "series";
  const episodes = useMemo(() => (isSeries ? episodesFor(title, season) : []), [isSeries, title, season]);
  const ep = episodes.find((e) => e.number === episode);
  const nextEp = useMemo(() => {
    if (!isSeries) return null;
    if (episode < episodes.length) return { season, episode: episode + 1 };
    if (season < (title.seasons ?? 1)) return { season: season + 1, episode: 1 };
    return null;
  }, [isSeries, episode, episodes.length, season, title.seasons]);

  const maxHeight = PLAN_MAX_HEIGHT[planId] ?? 1080;

  const [srcIdx, setSrcIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showUi, setShowUi] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [levels, setLevels] = useState<{ index: number; height: number }[]>([]);
  const [quality, setQuality] = useState<number | "auto" | "saver">("auto");
  const [actualHeight, setActualHeight] = useState(0);
  const [audioTracks, setAudioTracks] = useState<Track[]>([]);
  const [audio, setAudio] = useState(0);
  const [subTracks, setSubTracks] = useState<Track[]>([]);
  const [sub, setSub] = useState(-1);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [scrub, setScrub] = useState<number | null>(null);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [sleepAt, setSleepAt] = useState<number | "end" | null>(null);
  const [blocked, setBlocked] = useState<null | "sleep" | "limit" | "still" | "screens" | "stopped">(null);
  const [streamId] = useState(() => Math.random().toString(36).slice(2, 10));
  const [others, setOthers] = useState<LiveStream[]>([]);
  const [screenLimit, setScreenLimit] = useState(1);
  const [castTo, setCastTo] = useState<string | null>(null);
  const [wmPos, setWmPos] = useState(0);
  const protect = useMemo(() => siteSettings(), []);
  const [notice, setNotice] = useState("");
  const lastTick = useRef<number | null>(null);
  const logged = useRef(false);
  const capWarned = useRef(false);

  /* ---------------- Concurrent streams ---------------- */
  const claimStream = useCallback(() => {
    const r = claim({ id: streamId, email, profile: profileName, device: deviceName(), titleId: title.id, title: title.title }, planId);
    if (r.ok) return true;
    videoRef.current?.pause();
    if (r.limit === -1) setBlocked("stopped");
    else {
      setOthers(r.others);
      setScreenLimit(r.limit);
      setBlocked("screens");
    }
    return false;
  }, [streamId, email, profileName, title.id, title.title, planId]);

  useEffect(() => {
    if (!playing) return;
    if (!claimStream()) return;
    const id = setInterval(claimStream, 10000);
    return () => clearInterval(id);
  }, [playing, claimStream]);

  useEffect(() => () => release(streamId), [streamId]);

  // Forensic-style visible watermark moves around so it can't be cropped out
  useEffect(() => {
    if (!protect.watermarkEnabled) return;
    const id = setInterval(() => setWmPos((p) => (p + 1) % 4), 20000);
    return () => clearInterval(id);
  }, [protect.watermarkEnabled]);

  /* ---------------- Casting ---------------- */
  const startCast = async () => {
    const v = videoRef.current as (HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void }) | null;
    if (!v) return;
    try {
      if (v.webkitShowPlaybackTargetPicker) return v.webkitShowPlaybackTargetPicker(); // AirPlay (Safari)
      if (v.remote && !hlsRef.current) {
        await v.remote.prompt(); // Chromecast / Remote Playback API
        return;
      }
    } catch {
      /* fall through to the device list */
    }
    setPanel(panel === "cast" ? null : "cast");
  };

  useEffect(() => {
    const v = videoRef.current;
    const r = v?.remote;
    if (!r) return;
    const on = () => setCastTo(r.state === "connected" ? "your TV" : null);
    r.addEventListener("connect", on);
    r.addEventListener("disconnect", on);
    return () => {
      r.removeEventListener("connect", on);
      r.removeEventListener("disconnect", on);
    };
  }, []);

  // Demo casting: the TV plays the sound, so mute this screen while connected
  useEffect(() => {
    const v = videoRef.current;
    if (v && castTo && castTo !== "your TV") v.muted = true;
    else if (v && !castTo) v.muted = false;
  }, [castTo]);

  /* ---------------- Progress ---------------- */
  const save = useCallback(
    (force = false) => {
      const v = videoRef.current;
      if (!v || !v.duration || !isFinite(v.duration)) return;
      const now = Date.now();
      if (!force && now - lastSave.current < 5000) return;
      lastSave.current = now;
      const pct = Math.round((v.currentTime / v.duration) * 100);
      if (pct >= 95) {
        if (nextEp) writeProgress(profileId, title.id, { pct: 0, time: 0, season: nextEp.season, episode: nextEp.episode });
        else writeProgress(profileId, title.id, null);
      } else if (v.currentTime > 10) {
        writeProgress(profileId, title.id, { pct, time: v.currentTime, duration: v.duration, season, episode });
      }
    },
    [profileId, title.id, season, episode, nextEp],
  );

  /* ---------------- Load stream ---------------- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const src = sources[srcIdx];
    const saved = readProgress(profileId, title.id);
    const resumeAt = startAt !== undefined ? startAt :
      saved && saved.time && (saved.season ?? 1) === season && (saved.episode ?? 1) === episode ? saved.time : 0;

    setError("");
    setBuffering(true);
    setEnded(false);

    const tryNext = () => {
      if (srcIdx < sources.length - 1) setSrcIdx((i) => i + 1);
      else setError("We're having trouble playing this title right now. Check your connection and try again.");
    };

    if (Hls.isSupported() && /\.m3u8(\?|$)/i.test(src)) {
      const hls = new Hls({ startPosition: resumeAt || -1, capLevelToPlayerSize: false, enableWorkerVersionCheck: false } as Partial<Hls["config"]>);
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(v);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const all = hls.levels.map((l: Level, index: number) => ({ index, height: l.height || 0 }));
        const allowed = all.filter((l) => l.height <= maxHeight);
        const cap = allowed.length ? Math.max(...allowed.map((l) => l.index)) : -1;
        hls.autoLevelCapping = cap;
        // One entry per resolution, highest first
        const unique = new Map<number, number>();
        allowed.forEach((l) => unique.set(l.height, l.index));
        setLevels([...unique.entries()].map(([height, index]) => ({ height, index })).sort((a, b) => b.height - a.height));
        // Profile data-usage preference
        if (prefs.dataUsage === "saver" || prefs.dataUsage === "hd") {
          const limit = prefs.dataUsage === "saver" ? 480 : 1080;
          const within = allowed.filter((l) => l.height <= limit);
          const pick = within.length ? Math.max(...within.map((l) => l.index)) : Math.min(...allowed.map((l) => l.index));
          if (isFinite(pick)) hls.autoLevelCapping = pick;
          if (prefs.dataUsage === "saver") setQuality("saver");
        }
        v.play().catch(() => setPlaying(false));
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => setActualHeight(hls.levels[d.level]?.height ?? 0));
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e, d) => {
        setAudioTracks(d.audioTracks.map((t, i) => ({ id: i, label: t.name || t.lang || `Track ${i + 1}` })));
        setAudio(hls.audioTrack);
      });
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, d) => {
        setSubTracks(d.subtitleTracks.map((t, i) => ({ id: i, label: t.name || t.lang || `Subtitle ${i + 1}` })));
        hls.subtitleTrack = -1;
      });
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else tryNext();
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    // Safari / iOS: native HLS
    v.src = src;
    const onMeta = () => {
      if (resumeAt) v.currentTime = resumeAt;
      v.play().catch(() => setPlaying(false));
    };
    v.addEventListener("loadedmetadata", onMeta, { once: true });
    v.addEventListener("error", tryNext, { once: true });
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("error", tryNext);
      v.removeAttribute("src");
      v.load();
    };
  }, [sources, srcIdx, profileId, title.id, season, episode, maxHeight, prefs.dataUsage, startAt]);

  // Save on leave
  useEffect(() => {
    const onHide = () => save(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      save(true);
    };
  }, [save]);

  /* ---------------- Controls visibility ---------------- */
  const poke = useCallback(() => {
    setShowUi(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!videoRef.current?.paused) {
        setShowUi(false);
        setPanel(null);
      }
    }, 3000);
  }, []);

  useEffect(() => {
    poke();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [poke]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* ---------------- Actions ---------------- */
  const showFlash = (s: string) => {
    setFlash(s);
    setTimeout(() => setFlash(null), 500);
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      showFlash("play");
    } else {
      v.pause();
      showFlash("pause");
    }
    poke();
  }, [poke]);

  const seekBy = useCallback(
    (d: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.min(Math.max(0, v.currentTime + d), v.duration || 0);
      showFlash(d > 0 ? "fwd" : "back");
      poke();
    },
    [poke],
  );

  const setVol = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  };

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.5;
  }, []);

  const toggleFs = useCallback(() => {
    const el = wrapRef.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else v?.webkitEnterFullscreen?.();
  }, []);

  const goEpisode = useCallback(
    (s: number, e: number) => {
      save(true);
      if (onEpisode) onEpisode(s, e);
      else router.replace(`/watch?id=${title.id}&s=${s}&e=${e}`);
    },
    [router, save, title.id, onEpisode],
  );

  const exit = () => {
    save(true);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (onExit) onExit();
    else router.push("/browse");
  };

  const chooseQuality = (q: number | "auto" | "saver") => {
    const hls = hlsRef.current;
    setQuality(q);
    setPanel(null);
    if (!hls) return;
    const allowedCap = Math.max(-1, ...levels.map((l) => l.index));
    if (q === "auto") {
      hls.autoLevelCapping = allowedCap;
      hls.currentLevel = -1;
    } else if (q === "saver") {
      const low = [...levels].reverse().filter((l) => l.height <= 480).pop() ?? levels[levels.length - 1];
      hls.autoLevelCapping = low ? low.index : allowedCap;
      hls.currentLevel = -1;
    } else {
      hls.autoLevelCapping = allowedCap;
      hls.currentLevel = q;
    }
  };

  const chooseSub = (id: number) => {
    setSub(id);
    const hls = hlsRef.current;
    const v = videoRef.current;
    if (id >= 1000) {
      // Subtitle file uploaded in the admin dashboard
      if (hls) hls.subtitleTrack = -1;
      if (v) setNativeByLabel(v, extraSubs[id - 1000]?.label ?? null);
      return;
    }
    if (v && extraSubs.length) setNativeByLabel(v, null);
    if (hls) {
      hls.subtitleTrack = id;
      hls.subtitleDisplay = id >= 0;
    } else {
      if (videoRef.current) setNativeSubtitle(videoRef.current, id);
    }
  };

  const chooseAudio = (id: number) => {
    setAudio(id);
    if (hlsRef.current) hlsRef.current.audioTrack = id;
  };

  const chooseRate = (r: number) => {
    setRate(r);
    if (videoRef.current) videoRef.current.playbackRate = r;
    setPanel(null);
  };

  const shareMoment = () => {
    const base = window.location.pathname.replace(/\/watch\/?$/, "");
    const url = `${window.location.origin}${base}/watch/?id=${title.id}${isSeries ? `&s=${season}&e=${episode}` : ""}&t=${Math.floor(videoRef.current?.currentTime ?? 0)}`;
    navigator.clipboard?.writeText(url).then(
      () => setNotice("Link copied. Friends will start from this exact moment."),
      () => setNotice(url),
    );
  };

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  /* ---------------- Keyboard ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const v = videoRef.current;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          seekBy(10);
          break;
        case "ArrowLeft":
          seekBy(-10);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (v) setVol(Math.min(1, v.volume + 0.1));
          poke();
          break;
        case "ArrowDown":
          e.preventDefault();
          if (v) setVol(Math.max(0, v.volume - 0.1));
          poke();
          break;
        case "f":
          toggleFs();
          break;
        case "m":
          toggleMute();
          poke();
          break;
        case "Escape":
          setPanel(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, toggleFs, toggleMute, poke]);

  /* ---------------- Next episode countdown ---------------- */
  useEffect(() => {
    if (!ended || !nextEp || !prefs.autoplayNext) return;
    setCountdown(10);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          // Netflix-style "Are you still watching?" after 3 autoplayed episodes in a row
          let chain = 0;
          try {
            chain = Number(sessionStorage.getItem("myflix.autoplayChain") ?? "0") + 1;
            sessionStorage.setItem("myflix.autoplayChain", String(chain));
          } catch {}
          if (chain >= 3) setBlocked("still");
          else goEpisode(nextEp.season, nextEp.episode);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [ended, nextEp, goEpisode, prefs.autoplayNext]);

  /* ---------------- Seek bar ---------------- */
  const barRef = useRef<HTMLDivElement>(null);
  const ratioAt = (clientX: number) => {
    const r = barRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const onBarDown = (e: React.PointerEvent) => {
    if (!duration) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setScrub(ratioAt(e.clientX) * duration);
  };
  const onBarMove = (e: React.PointerEvent) => {
    if (!duration) return;
    const t = ratioAt(e.clientX) * duration;
    const r = barRef.current!.getBoundingClientRect();
    setHover({ x: e.clientX - r.left, t });
    if (scrub !== null) setScrub(t);
    poke();
  };
  const onBarUp = () => {
    if (scrub !== null && videoRef.current) videoRef.current.currentTime = scrub;
    setScrub(null);
  };

  const shown = scrub ?? current;
  const pct = duration ? (shown / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;
  const remaining = duration - current;
  const inIntro = Boolean(intro) && current >= intro!.start && current < intro!.end && duration > intro!.end + 20;
  const showNextCard = Boolean(nextEp) && duration > 0 && (ended || remaining <= 20);
  const label = isSeries && ep ? `S${season}:E${episode} "${ep.title}"` : "";

  const qualityText =
    quality === "auto" ? `Auto${actualHeight ? ` (${qualityLabel(actualHeight)})` : ""}` : quality === "saver" ? "Data Saver" : qualityLabel(levels.find((l) => l.index === quality)?.height ?? 0);

  return (
    <div
      ref={wrapRef}
      onMouseMove={poke}
      onTouchStart={poke}
      onContextMenu={(e) => e.preventDefault()}
      className={`fixed inset-0 z-50 select-none bg-black text-white ${showUi ? "" : "cursor-none"}`}
    >
      <style>{`video::cue{font-size:${prefs.subtitleSize === "small" ? "clamp(13px,1.8vw,22px)" : prefs.subtitleSize === "large" ? "clamp(20px,3.2vw,44px)" : "clamp(16px,2.4vw,32px)"};background:${prefs.subtitleBg === "box" ? "rgba(0,0,0,.8)" : "transparent"};text-shadow:${prefs.subtitleBg === "shadow" ? "0 0 4px #000,0 0 4px #000" : "none"}}`}</style>
      <video
        ref={videoRef}
        className="h-full w-full"
        playsInline
        crossOrigin="anonymous"
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        onClick={togglePlay}
        onDoubleClick={toggleFs}
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
          lastTick.current = performance.now();
          if (!logged.current) {
            logged.current = true;
            logActivity(profileId, { titleId: title.id, season: isSeries ? season : undefined, episode: isSeries ? episode : undefined });
          }
        }}
        onPause={() => {
          setPlaying(false);
          setShowUi(true);
          save(true);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setCurrent(v.currentTime);
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
          save();
          // Data meter + screen time
          const t = performance.now();
          if (!v.paused && lastTick.current !== null) addUsage(profileId, (t - lastTick.current) / 1000, actualHeight || v.videoHeight);
          lastTick.current = t;
          if (prefs.dailyLimitMinutes && watchedTodayMinutes(profileId) >= prefs.dailyLimitMinutes) {
            v.pause();
            setBlocked("limit");
          }
          if (prefs.monthlyDataCapGB && !capWarned.current && thisMonth(profileId).gb >= prefs.monthlyDataCapGB) {
            capWarned.current = true;
            setNotice(`You've reached your ${prefs.monthlyDataCapGB} GB monthly data limit. Switched to Data Saver.`);
            chooseQuality("saver");
          }
          if (typeof sleepAt === "number" && Date.now() >= sleepAt) {
            v.pause();
            setSleepAt(null);
            setBlocked("sleep");
          }
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onEnded={() => {
          setEnded(true);
          setShowUi(true);
          save(true);
          if (sleepAt === "end") {
            setSleepAt(null);
            setBlocked("sleep");
          }
        }}
      >
        {extraSubs.map((x, i) => (
          <track key={x.src} id={`admin-${i}`} kind="subtitles" label={x.label} srcLang={x.lang} src={x.src} />
        ))}
      </video>

      {/* Visible watermark (Admin > Settings > Forensic watermark) */}
      {protect.watermarkEnabled && (
        <span
          aria-hidden
          className={`pointer-events-none absolute z-10 font-mono text-xs text-white/15 transition-all duration-1000 sm:text-sm ${["left-[8%] top-[18%]", "right-[8%] top-[30%]", "left-[12%] bottom-[30%]", "right-[12%] bottom-[22%]"][wmPos]}`}
        >
          {email.split("@")[0]} · {streamId}
        </span>
      )}

      {/* Casting */}
      {castTo && (
        <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-cover bg-center text-center" style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.75),rgba(0,0,0,.9)),url(${img(title.backdrop ?? title.image, 1280, 720)})` }}>
          <IcCast className="h-14 w-14 text-brand-bright" />
          <p className="text-sm uppercase tracking-widest text-white/60">Playing on</p>
          <p className="text-2xl font-bold">{castTo}</p>
          <p className="text-white/70">{title.title}{label ? ` · ${label}` : ""}</p>
          <button onClick={() => { setCastTo(null); setNotice("Stopped casting. Playing here."); }} className="mt-2 rounded border border-white/60 px-5 py-2 text-sm font-semibold hover:bg-white hover:text-ink">Stop casting</button>
        </div>
      )}

      {/* Buffering */}
      {buffering && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner className="h-16 w-16 text-brand-bright" />
        </div>
      )}

      {/* Centre flash */}
      {flash && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="animate-ping rounded-full bg-black/50 p-5">
            {flash === "play" ? <IcPlay className="h-12 w-12" /> : flash === "pause" ? <IcPause className="h-12 w-12" /> : flash === "fwd" ? <IcFwd className="h-12 w-12" /> : <IcBack className="h-12 w-12" />}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center">
          <p className="max-w-md text-lg">{error}</p>
          <div className="flex gap-3">
            <button onClick={() => { setError(""); setSrcIdx(0); }} className="rounded bg-white px-6 py-2 font-semibold text-ink">Try Again</button>
            <button onClick={exit} className="rounded border border-white/60 px-6 py-2">{tx("Back to Browse")}</button>
          </div>
        </div>
      )}

      {/* Notices */}
      {notice && <div role="status" className="absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-md bg-white px-4 py-2 text-sm font-medium text-ink shadow-xl">{notice}</div>}

      {/* Blocking prompts: sleep timer, screen-time limit, still watching */}
      {blocked && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center">
          <p className="text-2xl font-bold">
            {blocked === "sleep" ? "Sleep timer ended" : blocked === "limit" ? "That's all for today" : blocked === "screens" ? "Too many people are using your account right now" : blocked === "stopped" ? "Playback stopped" : `Are you still watching ${title.title}?`}
          </p>
          {blocked === "screens" && (
            <div className="w-full max-w-md text-left">
              <p className="mb-3 text-center text-white/70">Your plan allows {screenLimit} screen{screenLimit > 1 ? "s" : ""} at a time. Stop one of these streams to watch here, or upgrade your plan.</p>
              <ul className="divide-y divide-white/10 rounded-md bg-white/5">
                {others.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex-1">
                      <span className="block font-semibold">{o.profile} on {o.device}</span>
                      <span className="block text-sm text-white/60">Watching {o.title}</span>
                    </span>
                    <button onClick={() => { stopStream(o.id, "member"); setOthers((l) => l.filter((x) => x.id !== o.id)); }} className="rounded bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25">Stop</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className={`max-w-md text-white/70 ${blocked === "screens" ? "hidden" : ""}`}>
            {blocked === "stopped"
              ? "Someone on your account, or MyFlix support, stopped this stream. You can start watching again if a screen is free."
              : blocked === "sleep"
              ? "Good night! We've paused so you don't miss anything."
              : blocked === "limit"
                ? `This profile has a ${prefs.dailyLimitMinutes}-minute daily viewing limit. A parent can change it in Account, Profiles.`
                : "We paused to save your data in case you fell asleep."}
          </p>
          <div className="flex gap-3">
            {blocked === "still" && nextEp && (
              <button onClick={() => { try { sessionStorage.setItem("myflix.autoplayChain", "0"); } catch {} setBlocked(null); goEpisode(nextEp.season, nextEp.episode); }} className="rounded bg-white px-6 py-2 font-semibold text-ink">{tx("Continue Watching")}</button>
            )}
            {blocked === "sleep" && (
              <button onClick={() => { setBlocked(null); videoRef.current?.play(); }} className="rounded bg-white px-6 py-2 font-semibold text-ink">Keep Watching</button>
            )}
            {(blocked === "screens" || blocked === "stopped") && (
              <button onClick={() => { if (blocked === "stopped") { release(streamId); location.reload(); return; } setBlocked(null); if (claimStream()) videoRef.current?.play(); }} className="rounded bg-white px-6 py-2 font-semibold text-ink">Try Again</button>
            )}
            {blocked === "screens" && (
              <button onClick={() => router.push("/account/plan")} className="rounded border border-white/60 px-6 py-2">Upgrade Plan</button>
            )}
            <button onClick={exit} className="rounded border border-white/60 px-6 py-2">{tx("Back to Browse")}</button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className={`absolute inset-x-0 top-0 flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent px-4 pb-10 pt-4 transition-opacity duration-300 sm:px-8 ${showUi ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <button onClick={exit} aria-label="Back to browse" className="rounded-full p-2 hover:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 5l-7 7 7 7" /></svg>
        </button>
        <span className="hidden text-sm text-white/70 sm:block">
          {planId === "premium" ? "Up to 4K Ultra HD" : `Your plan streams up to ${qualityLabel(maxHeight)}`}
        </span>
      </div>

      {/* Skip intro */}
      {inIntro && !showNextCard && (
        <button
          onClick={() => {
            if (videoRef.current && intro) videoRef.current.currentTime = intro.end;
          }}
          className="absolute bottom-32 right-6 rounded border-2 border-white/80 bg-black/60 px-6 py-2.5 text-lg font-semibold hover:bg-white hover:text-ink sm:right-12"
        >
          {tx("Skip Intro")}
        </button>
      )}

      {/* Next episode card */}
      {showNextCard && nextEp && (
        <div className="absolute bottom-32 right-6 w-72 rounded-md bg-ink-2/95 p-4 shadow-2xl sm:right-12">
          <p className="text-xs uppercase tracking-widest text-white/60">{tx("Next Episode")}</p>
          <p className="mt-1 font-semibold">
            S{nextEp.season}:E{nextEp.episode} {nextEp.season === season ? episodes.find((x) => x.number === nextEp.episode)?.title : "Pilot"}
          </p>
          <button onClick={() => goEpisode(nextEp.season, nextEp.episode)} className="mt-3 flex w-full items-center justify-center gap-2 rounded bg-white py-2 font-bold text-ink hover:bg-white/80">
            <IcPlay className="h-5 w-5" /> {ended && prefs.autoplayNext ? `Playing in ${countdown}s` : tx("Next Episode")}
          </button>
        </div>
      )}

      {/* Movie ended */}
      {ended && !nextEp && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-center">
          <p className="font-display text-5xl">{title.title}</p>
          <div className="flex gap-3">
            <button onClick={() => { if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play(); } }} className="rounded bg-white px-6 py-2 font-semibold text-ink">{tx("Watch Again")}</button>
            <button onClick={exit} className="rounded border border-white/60 px-6 py-2">{tx("Back to Browse")}</button>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-16 transition-opacity duration-300 sm:px-8 ${showUi ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        {/* Seek bar */}
        <div className="flex items-center gap-3">
          <div
            ref={barRef}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(shown)}
            tabIndex={0}
            onPointerDown={onBarDown}
            onPointerMove={onBarMove}
            onPointerUp={onBarUp}
            onPointerLeave={() => setHover(null)}
            className="group relative h-5 flex-1 cursor-pointer touch-none"
          >
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-white/25 transition-all group-hover:h-1.5">
              <div className="absolute inset-y-0 left-0 rounded bg-white/40" style={{ width: `${bufPct}%` }} />
              <div className="absolute inset-y-0 left-0 rounded bg-brand-bright" style={{ width: `${pct}%` }} />
            </div>
            <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-brand-bright transition group-hover:scale-100" style={{ left: `${pct}%` }} />
            {hover && (
              <span className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded bg-black/90 px-2 py-0.5 text-xs" style={{ left: hover.x }}>
                {fmt(hover.t)}
              </span>
            )}
          </div>
          <span className="w-16 text-right text-sm tabular-nums">{fmt(remaining > 0 ? remaining : 0)}</span>
        </div>

        {/* Buttons */}
        <div className="mt-2 flex items-center gap-1 sm:gap-3">
          <CtrlBtn label={playing ? "Pause" : "Play"} onClick={togglePlay}>{playing ? <IcPause /> : <IcPlay />}</CtrlBtn>
          <CtrlBtn label="Back 10 seconds" onClick={() => seekBy(-10)}><IcBack /></CtrlBtn>
          <CtrlBtn label="Forward 10 seconds" onClick={() => seekBy(10)}><IcFwd /></CtrlBtn>
          <div className="group/vol hidden items-center sm:flex">
            <CtrlBtn label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>{muted || volume === 0 ? <IcMute /> : <IcVol />}</CtrlBtn>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(Number(e.target.value))}
              aria-label="Volume"
              className="w-0 accent-brand-bright opacity-0 transition-all group-hover/vol:w-24 group-hover/vol:opacity-100"
            />
          </div>

          <p className="mx-2 min-w-0 flex-1 truncate text-center text-sm sm:text-base">
            <b>{title.title}</b> {label && <span className="text-white/70">{label}</span>}
          </p>

          {nextEp && <CtrlBtn label="Next episode" onClick={() => goEpisode(nextEp.season, nextEp.episode)}><IcNext /></CtrlBtn>}
          {isSeries && <CtrlBtn label="Episodes" active={panel === "episodes"} onClick={() => setPanel(panel === "episodes" ? null : "episodes")}><IcEpisodes /></CtrlBtn>}
          <CtrlBtn label="Audio and subtitles" active={panel === "audio"} onClick={() => setPanel(panel === "audio" ? null : "audio")}><IcSubs /></CtrlBtn>
          <CtrlBtn label="Sleep timer" active={panel === "sleep" || sleepAt !== null} onClick={() => setPanel(panel === "sleep" ? null : "sleep")}><IcMoon /></CtrlBtn>
          <CtrlBtn label="Share this moment" onClick={shareMoment}><IcShare /></CtrlBtn>
          <CtrlBtn label="Cast to TV" active={panel === "cast" || castTo !== null} onClick={startCast}><IcCast /></CtrlBtn>
          <CtrlBtn label="Playback speed" active={panel === "speed"} onClick={() => setPanel(panel === "speed" ? null : "speed")}><IcSpeed /></CtrlBtn>
          <CtrlBtn label="Video quality" active={panel === "quality"} onClick={() => setPanel(panel === "quality" ? null : "quality")}>
            <span className="rounded border border-current px-1 text-[11px] font-bold leading-4">{quality === "saver" ? "DS" : (actualHeight || 0) >= 2160 ? "4K" : "HD"}</span>
          </CtrlBtn>
          <CtrlBtn label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFs}>{fullscreen ? <IcFsExit /> : <IcFs />}</CtrlBtn>
        </div>
      </div>

      {/* Panels */}
      {panel && showUi && (
        <div className="absolute bottom-24 right-4 max-h-[60vh] w-[min(92vw,420px)] overflow-y-auto rounded-md bg-ink-2/95 p-4 shadow-2xl sm:right-8" onMouseMove={(e) => e.stopPropagation()}>
          {panel === "episodes" && (
            <>
              <p className="mb-3 text-lg font-bold">{tx("Season {0}", season)}</p>
              <ol className="space-y-1">
                {episodes.map((x) => (
                  <li key={x.number}>
                    <button onClick={() => goEpisode(season, x.number)} className={`flex w-full justify-between gap-3 rounded px-3 py-2.5 text-left hover:bg-white/10 ${x.number === episode ? "bg-white/10" : ""}`}>
                      <span><span className="mr-2 text-white/60">{x.number}</span>{x.title}</span>
                      <span className="text-sm text-white/60">{x.runtime}</span>
                    </button>
                  </li>
                ))}
              </ol>
              {(title.seasons ?? 1) > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.from({ length: title.seasons ?? 1 }, (_, i) => i + 1).map((s) => (
                    <button key={s} onClick={() => goEpisode(s, 1)} className={`rounded border px-3 py-1 text-sm ${s === season ? "border-white" : "border-white/30 text-white/70 hover:border-white"}`}>Season {s}</button>
                  ))}
                </div>
              )}
            </>
          )}

          {panel === "audio" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-2 font-bold">{tx("Audio")}</p>
                {audioTracks.length ? audioTracks.map((t) => (
                  <Opt key={t.id} on={audio === t.id} onClick={() => chooseAudio(t.id)}>{t.label}</Opt>
                )) : <Opt on onClick={() => {}}>Original</Opt>}
              </div>
              <div>
                <p className="mb-2 font-bold">{tx("Subtitles")}</p>
                <Opt on={sub === -1} onClick={() => chooseSub(-1)}>Off</Opt>
                {[...subTracks, ...extraSubs.map((x, i) => ({ id: 1000 + i, label: x.label }))].map((t) => (
                  <Opt key={t.id} on={sub === t.id} onClick={() => chooseSub(t.id)}>{t.label}</Opt>
                ))}
                {!subTracks.length && !extraSubs.length && <p className="mt-1 text-xs text-white/50">No subtitles for this title yet.</p>}
              </div>
            </div>
          )}

          {panel === "sleep" && (
            <>
              <p className="mb-1 font-bold">{tx("Sleep Timer")}</p>
              <p className="mb-3 text-xs text-white/60">{sleepAt === null ? "Off" : sleepAt === "end" ? "Stops at the end of this episode" : `Stops at ${new Date(sleepAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</p>
              <Opt on={sleepAt === null} onClick={() => { setSleepAt(null); setPanel(null); }}>Off</Opt>
              {[15, 30, 45, 60].map((m) => (
                <Opt key={m} on={false} onClick={() => { setSleepAt(Date.now() + m * 60000); setPanel(null); setNotice(`Sleep timer set for ${m} minutes.`); }}>{m} minutes</Opt>
              ))}
              <Opt on={sleepAt === "end"} onClick={() => { setSleepAt("end"); setPanel(null); setNotice(isSeries ? "Playback stops after this episode." : "Playback stops at the end."); }}>{isSeries ? "End of episode" : "End of film"}</Opt>
            </>
          )}

          {panel === "cast" && (
            <>
              <p className="mb-1 font-bold">{tx("Cast to")}</p>
              <p className="mb-3 text-xs text-white/60">Devices on your Wi-Fi network</p>
              {castTo && <Opt on onClick={() => { setCastTo(null); setPanel(null); }}>Stop casting to {castTo}</Opt>}
              {CAST_DEVICES.filter((d) => d !== castTo).map((d) => (
                <Opt key={d} on={false} onClick={() => { setCastTo(d); setPanel(null); setNotice(`Connected to ${d}.`); }}>{d}</Opt>
              ))}
              <p className="mt-3 text-xs text-white/50">Don&apos;t see your TV? Make sure it&apos;s on the same Wi-Fi, or open MyFlix on the TV and use Sign in with phone.</p>
            </>
          )}

          {panel === "speed" && (
            <>
              <p className="mb-4 font-bold">{tx("Playback Speed")}</p>
              <div className="flex items-center justify-between">
                {SPEEDS.map((s) => (
                  <button key={s} onClick={() => chooseRate(s)} className="flex flex-col items-center gap-2 text-sm">
                    <span className={`h-4 w-4 rounded-full border-2 ${rate === s ? "border-white bg-brand-bright" : "border-white/50"}`} />
                    <span className={rate === s ? "font-bold" : "text-white/70"}>{s}x{s === 1 ? " (Normal)" : ""}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {panel === "quality" && (
            <>
              <p className="mb-1 font-bold">{tx("Video Quality")}</p>
              <p className="mb-3 text-xs text-white/60">Now: {qualityText}</p>
              <Opt on={quality === "auto"} onClick={() => chooseQuality("auto")}>Auto (recommended)</Opt>
              <Opt on={quality === "saver"} onClick={() => chooseQuality("saver")}>Data Saver (about 0.3 GB/hr)</Opt>
              {levels.map((l) => (
                <Opt key={l.index} on={quality === l.index} onClick={() => chooseQuality(l.index)}>
                  {qualityLabel(l.height)}
                </Opt>
              ))}
              {maxHeight < 2160 && <p className="mt-3 text-xs text-white/50">Upgrade to Premium to watch in 4K Ultra HD.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function setNativeByLabel(video: HTMLVideoElement, label: string | null) {
  const tt = video.textTracks;
  for (let i = 0; i < tt.length; i++) {
    if (tt[i].kind === "subtitles" && tt[i].id.startsWith("admin-")) tt[i].mode = tt[i].label === label ? "showing" : "disabled";
  }
}

function setNativeSubtitle(video: HTMLVideoElement, id: number) {
  const tt = video.textTracks;
  for (let i = 0; i < tt.length; i++) tt[i].mode = i === id ? "showing" : "disabled";
}

function CtrlBtn({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded transition hover:scale-110 sm:h-12 sm:w-12 ${active ? "text-brand-bright" : ""}`}>
      {children}
    </button>
  );
}

function Opt({ children, on, onClick }: { children: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-white/10 ${on ? "font-semibold" : "text-white/70"}`}>
      <span className={`h-2 w-2 rounded-full ${on ? "bg-brand-bright" : "bg-transparent"}`} />
      {children}
    </button>
  );
}

const S = "h-7 w-7 sm:h-8 sm:w-8";
const IcPlay = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M6 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L7.5 3.64A1 1 0 0 0 6 4.5z" /></svg>);
const IcPause = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>);
const IcBack = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" /><text x="12" y="15.5" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" fontWeight="700">10</text></svg>);
const IcFwd = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" /><text x="12" y="15.5" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" fontWeight="700">10</text></svg>);
const IcVol = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></svg>);
const IcMute = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="m16 9 5 6M21 9l-5 6" /></svg>);
const IcNext = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M5 5v14l10-7zM17 5h2.5v14H17z" /></svg>);
const IcEpisodes = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="14" height="13" rx="1.5" /><path d="M7 4h13a1 1 0 0 1 1 1v11" strokeLinecap="round" /></svg>);
const IcSubs = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 13h4M13 13h4M7 16h7" /></svg>);
const IcSpeed = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4.5 18a9 9 0 1 1 15 0" /><path d="m12 13 4-5" /><circle cx="12" cy="13" r="1.3" fill="currentColor" /></svg>);
const IcMoon = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>);
const IcShare = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></svg>);
const IcCast = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 8V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-6" /><path d="M3 12a7 7 0 0 1 7 7M3 15.5A3.5 3.5 0 0 1 6.5 19" /><circle cx="3.5" cy="18.5" r=".8" fill="currentColor" /></svg>);
const IcFs = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>);
const IcFsExit = ({ className = S }) => (<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>);
