import { useMusicPlayer } from "@/contexts/MusicPlayerContext";

/**
 * A spacer component that adds bottom padding when the music player is visible.
 * Add this at the end of page content to prevent the player from covering content.
 */
export default function MusicPlayerSpacer() {
  const { isPlayerVisible } = useMusicPlayer();
  
  if (!isPlayerVisible) return null;
  
  // Height of the music player bar (py-3 = 12px * 2 + content ~= 72px)
  return <div className="h-20" />;
}

