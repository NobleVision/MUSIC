import { ReactNode } from "react";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { cn } from "@/lib/utils";

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * A wrapper component for pages that adjusts background transparency
 * when the video background is playing.
 * 
 * When video is playing: Uses semi-transparent background
 * When video is not playing: Uses normal opaque background
 */
export default function PageWrapper({ children, className }: PageWrapperProps) {
  const { shouldShowVideoBackground } = useMusicPlayer();
  
  return (
    <div
      className={cn(
        "min-h-screen relative z-10 transition-colors duration-500",
        shouldShowVideoBackground
          ? "bg-transparent"
          : "bg-gradient-to-br from-purple-50 to-blue-50",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Header component that adjusts for video background
 */
export function PageHeader({ children, className }: PageWrapperProps) {
  const { shouldShowVideoBackground } = useMusicPlayer();
  
  return (
    <header
      className={cn(
        "border-b shadow-sm transition-colors duration-500",
        shouldShowVideoBackground
          ? "bg-white/80 backdrop-blur-sm border-gray-200/50"
          : "bg-white border-gray-200",
        className
      )}
    >
      {children}
    </header>
  );
}

/**
 * Card component that adjusts for video background
 */
export function PageCard({ children, className }: PageWrapperProps) {
  const { shouldShowVideoBackground } = useMusicPlayer();
  
  return (
    <div
      className={cn(
        "rounded-lg border shadow-sm transition-colors duration-500",
        shouldShowVideoBackground
          ? "bg-white/90 backdrop-blur-sm border-gray-200/50"
          : "bg-white border-gray-200",
        className
      )}
    >
      {children}
    </div>
  );
}

