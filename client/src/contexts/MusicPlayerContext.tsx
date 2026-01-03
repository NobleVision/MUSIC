import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import type { MediaFile } from "../../../drizzle/schema";

export interface Track {
  id: number;
  title: string;
  artistName?: string | null;
  fileUrl: string;
  coverArtUrl?: string | null;
  musicStyle?: string | null;
  mediaType: "audio" | "video";
}

interface MusicPlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isLoading: boolean;
}

interface VideoBackgroundState {
  enabled: boolean;
  currentVideoUrl: string | null;
}

interface MusicPlayerContextType extends MusicPlayerState {
  play: (track: Track) => void;
  playMediaFile: (mediaFile: MediaFile) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  seek: (time: number) => void;
  togglePlay: () => void;
  /** Whether the player bar is visible (track loaded) */
  isPlayerVisible: boolean;
  /** Video background state and controls */
  videoBackground: VideoBackgroundState;
  toggleVideoBackground: () => void;
  /** Whether video should currently be shown (enabled + playing + not reduced motion) */
  shouldShowVideoBackground: boolean;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error("useMusicPlayer must be used within a MusicPlayerProvider");
  }
  return context;
}

interface MusicPlayerProviderProps {
  children: ReactNode;
}

// Video files from public/videos
const VIDEO_FILES = [
  "Abstract_3d_landscape_202512190113_e10cw.mp4",
  "Aerial_view_of_202512190112_c4max.mp4",
  "Ambient_glow_from_202512190116_6essw.mp4",
  "Animated_neon_audio_202512190109_2q2m3.mp4",
  "Animated_sheet_music_202512190113_g9g4j.mp4",
  "Artistic_blurred_silhouettes_202512190115_ivr.mp4",
  "Blurred_album_artwork_202512190114_zb0ld.mp4",
  "Blurred_view_through_202512190114_0f2hq.mp4",
  "Cinematic_pan_across_202512190112_8u2ld.mp4",
  "Colorful_lights_dancing_202512190112_rj1m7.mp4",
  "Gentle_frequency_bars_202512190114_0zbmd.mp4",
  "Gentle_light_rays_202512190114_08a0b.mp4",
  "Gentle_waves_of_202512190115_jijv3.mp4",
  "Geometric_shapes_morphing_202512190113_5wnqg.mp4",
  "Minimal_particle_field_202512190115_pzfkr.mp4",
  "Smooth_flowing_gradient_202512190113_wmbdp.mp4",
  "Smooth_gradient_mesh_202512190114_z9v4g.mp4",
  "Sparse_floating_particles_202512190113_uc5ei.mp4",
  "Subtle_constellation_of_202512190114_a48er.mp4",
  "Subtle_geometric_patterns_202512190113_hh0og.mp4",
  "Very_gentle_pulsing_202512190116_7z0hf.mp4",
];

const VIDEO_BG_ENABLED_KEY = "music-player-video-bg-enabled";

function getRandomVideo(): string {
  const randomIndex = Math.floor(Math.random() * VIDEO_FILES.length);
  return `/videos/${VIDEO_FILES[randomIndex]}`;
}

export function MusicPlayerProvider({ children }: MusicPlayerProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<MusicPlayerState>({
    currentTrack: null,
    isPlaying: false,
    volume: 0.7,
    currentTime: 0,
    duration: 0,
    isLoading: false,
  });

  // Video background state - persisted to localStorage
  const [videoBackground, setVideoBackground] = useState<VideoBackgroundState>(() => {
    const saved = localStorage.getItem(VIDEO_BG_ENABLED_KEY);
    return {
      enabled: saved === null ? true : saved === "true", // Default to enabled
      currentVideoUrl: getRandomVideo(),
    };
  });

  // Check for prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  // Listen for reduced motion preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = state.volume;
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setState(s => ({ ...s, currentTime: audio.currentTime }));
    };

    const handleDurationChange = () => {
      setState(s => ({ ...s, duration: audio.duration || 0 }));
    };

    const handleEnded = () => {
      setState(s => ({ ...s, isPlaying: false, currentTime: 0 }));
    };

    const handleLoadStart = () => {
      setState(s => ({ ...s, isLoading: true }));
    };

    const handleCanPlay = () => {
      setState(s => ({ ...s, isLoading: false }));
    };

    const handleError = (e: Event) => {
      console.error("[MusicPlayer] Audio error:", e);
      setState(s => ({ ...s, isPlaying: false, isLoading: false }));
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  const play = useCallback((track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = track.fileUrl;
    audio.load();
    audio.play().catch(err => {
      console.error("[MusicPlayer] Failed to play:", err);
    });
    
    setState(s => ({
      ...s,
      currentTrack: track,
      isPlaying: true,
      currentTime: 0,
    }));
  }, []);

  const playMediaFile = useCallback((mediaFile: MediaFile) => {
    play({
      id: mediaFile.id,
      title: mediaFile.title,
      artistName: mediaFile.artistName,
      fileUrl: mediaFile.fileUrl,
      coverArtUrl: mediaFile.coverArtUrl,
      musicStyle: mediaFile.musicStyle,
      mediaType: mediaFile.mediaType,
    });
  }, [play]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState(s => ({ ...s, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().catch(console.error);
    setState(s => ({ ...s, isPlaying: true }));
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setState(s => ({ ...s, isPlaying: false, currentTime: 0, currentTrack: null }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    setState(s => ({ ...s, volume }));
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setState(s => ({ ...s, currentTime: time }));
  }, []);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [state.isPlaying, pause, resume]);

  const toggleVideoBackground = useCallback(() => {
    setVideoBackground(prev => {
      const newEnabled = !prev.enabled;
      localStorage.setItem(VIDEO_BG_ENABLED_KEY, String(newEnabled));
      return {
        ...prev,
        enabled: newEnabled,
        // Pick a new random video when enabling
        currentVideoUrl: newEnabled ? getRandomVideo() : prev.currentVideoUrl,
      };
    });
  }, []);

  const isPlayerVisible = state.currentTrack !== null;

  // Show video background when: enabled + music playing + not reduced motion
  const shouldShowVideoBackground =
    videoBackground.enabled &&
    state.isPlaying &&
    !prefersReducedMotion &&
    videoBackground.currentVideoUrl !== null;

  return (
    <MusicPlayerContext.Provider value={{
      ...state,
      play,
      playMediaFile,
      pause,
      resume,
      stop,
      setVolume,
      seek,
      togglePlay,
      isPlayerVisible,
      videoBackground,
      toggleVideoBackground,
      shouldShowVideoBackground,
    }}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

