import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type TransitionType = 
  | "fade"
  | "crossDissolve"
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "slideDown"
  | "scale"
  | "blur";

interface VideoBackgroundProps {
  videoDirectory?: string;
  videoDuration?: number; // Duration in seconds
  transitionDuration?: number; // Transition duration in seconds
  className?: string;
}

const TRANSITION_TYPES: TransitionType[] = [
  "fade",
  "crossDissolve",
  "slideLeft",
  "slideRight",
  "slideUp",
  "slideDown",
  "scale",
  "blur",
];

const getTransitionVariants = (type: TransitionType) => {
  const baseDuration = 1.5;
  
  switch (type) {
    case "fade":
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: baseDuration, ease: "easeInOut" },
      };
    
    case "crossDissolve":
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: baseDuration * 1.2, ease: "easeInOut" },
      };
    
    case "slideLeft":
      return {
        initial: { x: "100%", opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "-100%", opacity: 0 },
        transition: { duration: baseDuration, ease: "easeInOut" },
      };
    
    case "slideRight":
      return {
        initial: { x: "-100%", opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "100%", opacity: 0 },
        transition: { duration: baseDuration, ease: "easeInOut" },
      };
    
    case "slideUp":
      return {
        initial: { y: "100%", opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: "-100%", opacity: 0 },
        transition: { duration: baseDuration, ease: "easeInOut" },
      };
    
    case "slideDown":
      return {
        initial: { y: "-100%", opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: "100%", opacity: 0 },
        transition: { duration: baseDuration, ease: "easeInOut" },
      };
    
    case "scale":
      return {
        initial: { scale: 1.2, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.8, opacity: 0 },
        transition: { duration: baseDuration, ease: "easeInOut" },
      };
    
    case "blur":
      return {
        initial: { filter: "blur(20px)", opacity: 0 },
        animate: { filter: "blur(0px)", opacity: 1 },
        exit: { filter: "blur(20px)", opacity: 0 },
        transition: { duration: baseDuration, ease: "easeInOut" },
      };
    
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: baseDuration, ease: "easeInOut" },
      };
  }
};

export default function VideoBackground({
  videoDirectory = "/videos",
  videoDuration = 12, // Default 12 seconds
  transitionDuration = 1.5,
  className = "",
}: VideoBackgroundProps) {
  const [videos, setVideos] = useState<string[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [nextVideoIndex, setNextVideoIndex] = useState(1);
  const [transitionType, setTransitionType] = useState<TransitionType>("fade");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  const currentVideoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const preloadRef = useRef<HTMLVideoElement | null>(null);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Discover available videos
  useEffect(() => {
    const discoverVideos = async () => {
      try {
        // In a real app, you might want to fetch a list from an API
        // For now, we'll use a hardcoded list based on the files we know exist
        // In production, you could use a build-time script to generate this list
        const videoFiles = [
          "Abstract_3d_landscape_202512190113_e10cw.mp4",
          "Aerial_view_of_202512190112_c4max.mp4",
          "Ambient_glow_from_202512190116_6essw.mp4",
          "Animated_neon_audio_202512190109_2q2m3.mp4",
          "Animated_sheet_music_202512190113_g9g4j.mp4",
          "Artistic_blurred_silhouettes_202512190115_ivr.mp4",
          "Blurred_album_artwork_202512190114_zb0ld.mp4",
          "Blurred_view_through_202512190114_0f2hq.mp4",
          "Cinematic_pan_across_202512190112_8u2ld.mp4",
          "Closeup_of_a_202512190108_j27h1.mp4",
          "Closeup_of_dj_202512190113_5aj05.mp4",
          "Colorful_lights_dancing_202512190112_rj1m7.mp4",
          "Concentric_circles_expanding_202512190115_dii.mp4",
          "Concentric_circular_frequency_202512190109_yu.mp4",
          "Dreamy_softfocus_view_202512190116_0fejc.mp4",
          "Elegant_overhead_shot_202512190109_x6nvu.mp4",
          "Extreme_closeup_of_202512190112_k6es6.mp4",
          "Flowing_colorful_sound_202512190108_vtzkx.mp4",
          "Futuristic_grid_of_202512190110_i1zic.mp4",
          "Gentle_frequency_bars_202512190114_0zbmd.mp4",
          "Gentle_light_rays_202512190114_08a0b.mp4",
          "Gentle_waves_of_202512190115_jijv3.mp4",
          "Geometric_shapes_morphing_202512190113_5wnqg.mp4",
          "Glowing_sphere_of_202512190113_z9kwe.mp4",
          "Large_soft_gradient_202512190116_5upzu.mp4",
          "Macro_slowmotion_of_202512190109_6mm60.mp4",
          "Minimal_particle_field_202512190115_pzfkr.mp4",
          "Multiple_vinyl_records_202512190109_lmk9d.mp4",
          "Outoffocus_stage_lights_202512190113_zk08j.mp4",
          "Professional_studio_headphones_202512190109_x.mp4",
          "Retrostyle_neon_equalizer_202512190109_dbh96.mp4",
          "Shallow_depthoffield_shot_202512190115_mowq.mp4",
          "Silklike_fabric_in_202512190115_lcpx6.mp4",
          "Single_elegant_waveform_202512190114_gznmd.mp4",
          "Slowmotion_liquid_ink_202512190113_6ntxb.mp4",
          "Smooth_flowing_gradient_202512190113_wmbdp.mp4",
          "Smooth_gradient_mesh_202512190114_z9v4g.mp4",
          "Softfocus_shot_of_202512190114_3itvs.mp4",
          "Softly_lit_empty_202512190115_gveh2.mp4",
          "Softly_lit_recording_202512190109_j8gsk.mp4",
          "Sparse_floating_particles_202512190113_uc5ei.mp4",
          "Spinning_vinyl_record_202512190113_k7qfm.mp4",
          "Subtle_constellation_of_202512190114_a48er.mp4",
          "Subtle_geometric_patterns_202512190113_hh0og.mp4",
          "Thousands_of_glowing_202512190109_l7d7r.mp4",
          "Translucent_holographic_musical_202512190112_.mp4",
          "Very_gentle_pulsing_202512190116_7z0hf.mp4",
          "Vintage_microphone_center_202512190109_4zjiv.mp4",
          "Warmtoned_acoustic_guitar_202512190113_ob9c8.mp4",
        ];

        const videoPaths = videoFiles.map(file => `${videoDirectory}/${file}`);
        
        // Shuffle array for random order
        const shuffled = [...videoPaths].sort(() => Math.random() - 0.5);
        setVideos(shuffled);
        
        if (shuffled.length > 0) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error discovering videos:", err);
        setError(true);
        setIsLoading(false);
      }
    };

    discoverVideos();
  }, [videoDirectory]);

  // Get random next video index (different from current)
  const getRandomNextIndex = useCallback((currentIndex: number, total: number) => {
    if (total <= 1) return 0;
    let next;
    do {
      next = Math.floor(Math.random() * total);
    } while (next === currentIndex && total > 1);
    return next;
  }, []);

  // Get random transition type
  const getRandomTransition = useCallback((): TransitionType => {
    return TRANSITION_TYPES[Math.floor(Math.random() * TRANSITION_TYPES.length)];
  }, []);

  // Preload next video
  useEffect(() => {
    if (videos.length === 0 || prefersReducedMotion) return;

    const nextVideo = videos[nextVideoIndex];
    if (!nextVideo) return;

    // Create a hidden video element for preloading
    if (!preloadRef.current) {
      preloadRef.current = document.createElement("video");
      preloadRef.current.preload = "auto";
      preloadRef.current.style.display = "none";
      document.body.appendChild(preloadRef.current);
    }

    preloadRef.current.src = nextVideo;
    preloadRef.current.load();

    return () => {
      if (preloadRef.current) {
        preloadRef.current.src = "";
      }
    };
  }, [videos, nextVideoIndex, prefersReducedMotion]);

  // Handle video transitions
  useEffect(() => {
    if (videos.length === 0 || prefersReducedMotion) return;

    const currentVideo = currentVideoRef.current;
    if (!currentVideo) return;

    // Set up video to loop but we'll transition before it loops
    currentVideo.loop = false;
    currentVideo.muted = true;
    currentVideo.playsInline = true;

    const handleTimeUpdate = () => {
      // Transition when video is near the end (accounting for transition duration)
      const transitionTime = transitionDuration * 1000; // Convert to ms
      const targetTime = (videoDuration * 1000) - transitionTime;
      
      if (currentVideo.currentTime * 1000 >= targetTime && !timeoutRef.current) {
        // Start transition
        setTransitionType(getRandomTransition());
        setCurrentVideoIndex(nextVideoIndex);
        setNextVideoIndex(getRandomNextIndex(nextVideoIndex, videos.length));
      }
    };

    const handleEnded = () => {
      // Fallback: transition when video ends
      setTransitionType(getRandomTransition());
      setCurrentVideoIndex(nextVideoIndex);
      setNextVideoIndex(getRandomNextIndex(nextVideoIndex, videos.length));
    };

    const handleError = () => {
      console.error("Video loading error, moving to next video");
      setError(true);
      // Try next video
      setTimeout(() => {
        setCurrentVideoIndex(nextVideoIndex);
        setNextVideoIndex(getRandomNextIndex(nextVideoIndex, videos.length));
        setError(false);
      }, 1000);
    };

    currentVideo.addEventListener("timeupdate", handleTimeUpdate);
    currentVideo.addEventListener("ended", handleEnded);
    currentVideo.addEventListener("error", handleError);

    // Play video
    currentVideo.play().catch((err) => {
      console.error("Error playing video:", err);
      setError(true);
    });

    return () => {
      currentVideo.removeEventListener("timeupdate", handleTimeUpdate);
      currentVideo.removeEventListener("ended", handleEnded);
      currentVideo.removeEventListener("error", handleError);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [
    videos,
    currentVideoIndex,
    nextVideoIndex,
    videoDuration,
    transitionDuration,
    getRandomTransition,
    getRandomNextIndex,
    prefersReducedMotion,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (preloadRef.current) {
        document.body.removeChild(preloadRef.current);
        preloadRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Fallback gradient background
  const fallbackBackground = "bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900";

  if (prefersReducedMotion || isLoading || error || videos.length === 0) {
    return (
      <div
        className={`fixed inset-0 -z-10 ${fallbackBackground} ${className}`}
        aria-hidden="true"
      />
    );
  }

  const currentVideo = videos[currentVideoIndex];
  if (!currentVideo) {
    return (
      <div
        className={`fixed inset-0 -z-10 ${fallbackBackground} ${className}`}
        aria-hidden="true"
      />
    );
  }

  const variants = getTransitionVariants(transitionType);

  return (
    <div className={`fixed inset-0 -z-10 overflow-hidden ${className}`} aria-hidden="true">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentVideoIndex}
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          transition={variants.transition}
          className="absolute inset-0"
        >
          <video
            ref={currentVideoRef}
            src={currentVideo}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            loop={false}
            onError={() => setError(true)}
          />
          {/* Overlay for better text readability */}
          <div className="absolute inset-0 bg-black/30" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

