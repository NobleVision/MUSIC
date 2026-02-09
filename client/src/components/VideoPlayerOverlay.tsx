import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { X, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Overlay that displays the actual video content when playing a video track.
 * This is separate from VideoBackgroundOverlay which shows decorative b-roll.
 * 
 * - Shows when currentTrack.mediaType === "video" and isPlaying
 * - Registers the video element with MusicPlayerContext for playback control
 * - Provides minimize/maximize and close controls
 */
export default function VideoPlayerOverlay() {
  const {
    currentTrack,
    isPlaying,
    isVideoTrack,
    volume,
    registerVideoElement,
    unregisterVideoElement,
    stop,
  } = useMusicPlayer();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  // Register video element with context when mounted
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideoTrack) return;

    registerVideoElement(video);

    return () => {
      unregisterVideoElement();
    };
  }, [isVideoTrack, registerVideoElement, unregisterVideoElement]);

  // Load and play video when track changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideoTrack || !currentTrack) return;

    setIsVideoReady(false);
    video.src = currentTrack.fileUrl;
    video.load();
    
    if (isPlaying) {
      video.play().catch(err => {
        console.error("[VideoPlayerOverlay] Failed to play:", err);
      });
    }
  }, [currentTrack?.fileUrl, isVideoTrack, currentTrack]);

  // Sync play/pause state with context
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideoTrack) return;

    if (isPlaying) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  }, [isPlaying, isVideoTrack]);

  // Sync volume with context
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
  }, [volume]);

  // Don't render if not a video track
  if (!isVideoTrack || !currentTrack) {
    return null;
  }

  const handleClose = () => {
    stop();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className={`fixed z-[50] ${
          isMinimized
            ? "bottom-24 right-4 w-80 h-48 rounded-lg shadow-2xl"
            : "inset-0 flex items-center justify-center bg-black/90"
        }`}
      >
        {/* Controls overlay */}
        <div className={`absolute ${isMinimized ? "top-2 right-2" : "top-4 right-4"} z-10 flex gap-2`}>
          <Button
            variant="ghost"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Video container */}
        <div className={`relative ${isMinimized ? "w-full h-full" : "w-full max-w-5xl max-h-[80vh]"}`}>
          <video
            ref={videoRef}
            className={`${
              isMinimized
                ? "w-full h-full object-cover rounded-lg"
                : "w-full h-full object-contain"
            }`}
            controls={!isMinimized}
            playsInline
            onLoadedData={() => setIsVideoReady(true)}
            onError={(e) => console.error("[VideoPlayerOverlay] Video error:", e)}
          />

          {/* Loading overlay */}
          {!isVideoReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Title bar for minimized view */}
          {isMinimized && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <p className="text-white text-sm truncate">{currentTrack.title}</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

