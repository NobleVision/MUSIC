import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Square, Volume2, VolumeX, Music, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function MusicPlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    isLoading,
    togglePlay,
    stop,
    setVolume,
    seek,
  } = useMusicPlayer();

  // Don't render if no track is loaded
  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Album Art / Icon */}
          <div className="flex-shrink-0">
            {currentTrack.coverArtUrl ? (
              <img
                src={currentTrack.coverArtUrl}
                alt={currentTrack.title}
                className="w-12 h-12 rounded-lg object-cover shadow-md"
              />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center shadow-md">
                <Music className="w-6 h-6 text-white" />
              </div>
            )}
          </div>

          {/* Track Info */}
          <div className="flex-shrink-0 min-w-0 w-48">
            <p className="font-medium text-gray-900 dark:text-white truncate text-sm">
              {currentTrack.title}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {currentTrack.artistName || currentTrack.musicStyle || "Unknown Artist"}
            </p>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              disabled={isLoading}
              className="h-10 w-10"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={stop}
              className="h-10 w-10"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1">
              <Slider
                value={[progress]}
                max={100}
                step={0.1}
                onValueChange={([value]) => {
                  if (duration > 0) {
                    seek((value / 100) * duration);
                  }
                }}
                className="cursor-pointer"
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-10">
              {formatTime(duration)}
            </span>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2 w-32">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
              className="h-8 w-8"
            >
              {volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[volume * 100]}
              max={100}
              step={1}
              onValueChange={([value]) => setVolume(value / 100)}
              className="w-20"
            />
          </div>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={stop}
            className="h-8 w-8 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

