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

  const isPlayerVisible = state.currentTrack !== null;

  return (
    <MusicPlayerContext.Provider value={{ ...state, play, playMediaFile, pause, resume, stop, setVolume, seek, togglePlay, isPlayerVisible }}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

