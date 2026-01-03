import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";

/**
 * A subtle video background overlay that plays when music is playing.
 * - Low opacity (20-30%) to not interfere with content
 * - Dark overlay for better text contrast
 * - Respects prefers-reduced-motion
 * - Persists across page navigations
 */
export default function VideoBackgroundOverlay() {
  const { shouldShowVideoBackground, videoBackground, isPlaying } = useMusicPlayer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Handle video playback based on music playing state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying && shouldShowVideoBackground) {
      video.play().catch(err => {
        console.warn("[VideoBackground] Failed to play video:", err);
        setHasError(true);
      });
    } else {
      video.pause();
    }
  }, [isPlaying, shouldShowVideoBackground]);
  
  // Reset error state when video URL changes
  useEffect(() => {
    setHasError(false);
    setIsVideoLoaded(false);
  }, [videoBackground.currentVideoUrl]);
  
  // Don't render if shouldn't show or has error
  if (!shouldShowVideoBackground || hasError || !videoBackground.currentVideoUrl) {
    return null;
  }
  
  return (
    <AnimatePresence>
      {shouldShowVideoBackground && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="fixed inset-0 overflow-hidden pointer-events-none"
          style={{ zIndex: -1 }}
          aria-hidden="true"
        >
          {/* Video element */}
          <video
            ref={videoRef}
            src={videoBackground.currentVideoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ 
              opacity: isVideoLoaded ? 0.25 : 0,
              transition: "opacity 1s ease-in-out",
            }}
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => setIsVideoLoaded(true)}
            onError={() => {
              console.warn("[VideoBackground] Video failed to load:", videoBackground.currentVideoUrl);
              setHasError(true);
            }}
          />
          
          {/* Dark overlay for text contrast */}
          <div 
            className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50"
            style={{ 
              opacity: isVideoLoaded ? 1 : 0,
              transition: "opacity 1s ease-in-out",
            }}
          />
          
          {/* Additional vignette effect for edges */}
          <div 
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)",
              opacity: isVideoLoaded ? 1 : 0,
              transition: "opacity 1s ease-in-out",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

