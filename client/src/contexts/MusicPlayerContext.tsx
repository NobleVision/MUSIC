import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import type { MediaFile } from "../../../drizzle/schema";

// Play tracking threshold: 30 seconds or 50% of track duration
const PLAY_THRESHOLD_SECONDS = 30;
const PLAY_THRESHOLD_PERCENTAGE = 0.5;

export interface Track {
  id: number;
  title: string;
  artistName?: string | null;
  fileUrl: string;
  coverArtUrl?: string | null;
  musicStyle?: string | null;
  mediaType: "audio" | "video";
}

interface PlaylistState {
  /** Queue of tracks to play */
  queue: Track[];
  /** Current position in the queue (index) */
  currentIndex: number;
  /** Whether shuffle mode is enabled */
  shuffleMode: boolean;
  /** Whether loop mode is enabled (repeat the whole playlist) */
  loopMode: boolean;
  /** Original order of tracks (used when toggling shuffle off) */
  originalOrder: Track[];
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
  /** Playlist functionality */
  playlist: PlaylistState;
  /** Play all tracks from an array of media files */
  playPlaylist: (mediaFiles: MediaFile[], shuffle?: boolean) => void;
  /** Toggle shuffle mode */
  toggleShuffle: () => void;
  /** Toggle loop mode */
  toggleLoop: () => void;
  /** Skip to next track in queue */
  skipNext: () => void;
  /** Skip to previous track in queue */
  skipPrevious: () => void;
  /** Clear the current playlist */
  clearPlaylist: () => void;
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
  /** Callback when a play should be recorded (threshold reached or track ended) */
  onPlayRecorded?: (mediaFileId: number, playDuration: number) => void;
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

// Helper function to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function MusicPlayerProvider({ children, onPlayRecorded }: MusicPlayerProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<MusicPlayerState>({
    currentTrack: null,
    isPlaying: false,
    volume: 0.7,
    currentTime: 0,
    duration: 0,
    isLoading: false,
  });

  // Playlist state
  const [playlist, setPlaylist] = useState<PlaylistState>({
    queue: [],
    currentIndex: -1,
    shuffleMode: false,
    loopMode: false,
    originalOrder: [],
  });

  // Track play recording state
  const playStartTimeRef = useRef<number>(0);
  const hasRecordedPlayRef = useRef<boolean>(false);
  const currentTrackIdRef = useRef<number | null>(null);

  // Store callback in a ref to avoid triggering effect re-runs when callback changes
  // This is critical: if onPlayRecorded is in the useEffect dependency array,
  // calling the mutation will cause the callback to change (mutation state changes),
  // which re-runs the effect and pauses the audio during cleanup!
  const onPlayRecordedRef = useRef(onPlayRecorded);
  useEffect(() => {
    onPlayRecordedRef.current = onPlayRecorded;
  }, [onPlayRecorded]);

  // Store playlist state in a ref for use in handleEnded
  const playlistRef = useRef(playlist);
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  // Ref for the onTrackEnded callback (to play next track)
  const onTrackEndedRef = useRef<(() => void) | null>(null);

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

  // Initialize audio element - runs only once on mount
  // IMPORTANT: Do NOT add onPlayRecorded to dependencies!
  // If the callback changes, this effect would re-run and pause the audio during cleanup.
  // Instead, we use onPlayRecordedRef which is updated separately.
  useEffect(() => {
    const audio = new Audio();
    audio.volume = state.volume;
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime;
      const duration = audio.duration || 0;

      setState(s => ({ ...s, currentTime }));

      // Check if we should record a play (threshold reached)
      // Use ref to get the latest callback without causing effect re-runs
      const callback = onPlayRecordedRef.current;
      if (
        !hasRecordedPlayRef.current &&
        currentTrackIdRef.current !== null &&
        duration > 0 &&
        callback
      ) {
        const playDuration = currentTime - playStartTimeRef.current;
        const thresholdReached =
          playDuration >= PLAY_THRESHOLD_SECONDS ||
          currentTime / duration >= PLAY_THRESHOLD_PERCENTAGE;

        if (thresholdReached) {
          hasRecordedPlayRef.current = true;
          callback(currentTrackIdRef.current, Math.round(playDuration));
        }
      }
    };

    const handleDurationChange = () => {
      setState(s => ({ ...s, duration: audio.duration || 0 }));
    };

    const handleEnded = () => {
      // Record play on track end if not already recorded
      // Use ref to get the latest callback
      const callback = onPlayRecordedRef.current;
      if (
        !hasRecordedPlayRef.current &&
        currentTrackIdRef.current !== null &&
        callback
      ) {
        const playDuration = audio.currentTime - playStartTimeRef.current;
        callback(currentTrackIdRef.current, Math.round(playDuration));
        hasRecordedPlayRef.current = true;
      }

      // Call onTrackEnded to handle playlist progression
      const onEnded = onTrackEndedRef.current;
      if (onEnded) {
        onEnded();
      } else {
        // No playlist active, just stop
        setState(s => ({ ...s, isPlaying: false, currentTime: 0 }));
      }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  const play = useCallback((track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset play tracking for new track
    playStartTimeRef.current = 0;
    hasRecordedPlayRef.current = false;
    currentTrackIdRef.current = track.id;

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

  // Play a track from the current queue by index
  const playTrackAtIndex = useCallback((index: number, queue: Track[]) => {
    if (index >= 0 && index < queue.length) {
      const track = queue[index];
      play(track);
      setPlaylist(prev => ({ ...prev, currentIndex: index }));
    }
  }, [play]);

  // Skip to next track in queue
  const skipNext = useCallback(() => {
    const { queue, currentIndex, loopMode } = playlistRef.current;
    if (queue.length === 0) return;

    let nextIndex = currentIndex + 1;

    if (nextIndex >= queue.length) {
      if (loopMode) {
        // Loop back to beginning
        nextIndex = 0;
      } else {
        // End of playlist, stop playing
        setState(s => ({ ...s, isPlaying: false, currentTime: 0 }));
        setPlaylist(prev => ({ ...prev, currentIndex: -1 }));
        return;
      }
    }

    playTrackAtIndex(nextIndex, queue);
  }, [playTrackAtIndex]);

  // Skip to previous track in queue
  const skipPrevious = useCallback(() => {
    const { queue, currentIndex } = playlistRef.current;
    if (queue.length === 0) return;

    // If we're more than 3 seconds into the track, restart it
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = playlist.loopMode ? queue.length - 1 : 0;
    }

    playTrackAtIndex(prevIndex, queue);
  }, [playTrackAtIndex, playlist.loopMode]);

  // Set up the onTrackEnded callback to use skipNext
  useEffect(() => {
    onTrackEndedRef.current = skipNext;
  }, [skipNext]);

  // Play all tracks from an array of media files
  const playPlaylist = useCallback((mediaFiles: MediaFile[], shuffle = false) => {
    if (mediaFiles.length === 0) return;

    // Convert MediaFiles to Tracks
    const tracks: Track[] = mediaFiles.map(mf => ({
      id: mf.id,
      title: mf.title,
      artistName: mf.artistName,
      fileUrl: mf.fileUrl,
      coverArtUrl: mf.coverArtUrl,
      musicStyle: mf.musicStyle,
      mediaType: mf.mediaType,
    }));

    // Shuffle if requested
    const queue = shuffle ? shuffleArray(tracks) : tracks;

    // Update playlist state
    setPlaylist({
      queue,
      currentIndex: 0,
      shuffleMode: shuffle,
      loopMode: playlist.loopMode, // Keep current loop setting
      originalOrder: tracks,
    });

    // Play the first track
    play(queue[0]);
  }, [play, playlist.loopMode]);

  // Toggle shuffle mode
  const toggleShuffle = useCallback(() => {
    setPlaylist(prev => {
      const newShuffleMode = !prev.shuffleMode;

      if (newShuffleMode) {
        // Switching to shuffle: shuffle the remaining tracks, keep current at position 0
        const currentTrack = prev.queue[prev.currentIndex];
        const remainingTracks = prev.queue.filter((_, i) => i !== prev.currentIndex);
        const shuffledRemaining = shuffleArray(remainingTracks);
        const newQueue = currentTrack ? [currentTrack, ...shuffledRemaining] : shuffledRemaining;

        return {
          ...prev,
          shuffleMode: true,
          queue: newQueue,
          currentIndex: 0,
        };
      } else {
        // Switching off shuffle: restore original order, find current track position
        const currentTrack = prev.queue[prev.currentIndex];
        const newIndex = prev.originalOrder.findIndex(t => t.id === currentTrack?.id);

        return {
          ...prev,
          shuffleMode: false,
          queue: prev.originalOrder,
          currentIndex: newIndex >= 0 ? newIndex : 0,
        };
      }
    });
  }, []);

  // Toggle loop mode
  const toggleLoop = useCallback(() => {
    setPlaylist(prev => ({
      ...prev,
      loopMode: !prev.loopMode,
    }));
  }, []);

  // Clear the current playlist
  const clearPlaylist = useCallback(() => {
    setPlaylist({
      queue: [],
      currentIndex: -1,
      shuffleMode: false,
      loopMode: false,
      originalOrder: [],
    });
    onTrackEndedRef.current = null;
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
      playlist,
      playPlaylist,
      toggleShuffle,
      toggleLoop,
      skipNext,
      skipPrevious,
      clearPlaylist,
    }}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

