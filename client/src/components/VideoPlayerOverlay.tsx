import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { X, Minimize2, Maximize2, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import VoteButtons from "@/components/VoteButtons";
import PopularityMetrics from "@/components/PopularityMetrics";

/**
 * Overlay that displays the actual video content when playing a video track.
 * This is separate from VideoBackgroundOverlay which shows decorative b-roll.
 *
 * - Shows when currentTrack.mediaType === "video" and isPlaying
 * - Registers the video element with MusicPlayerContext for playback control
 * - Provides minimize/maximize and close controls
 * - Includes social engagement features: view tracking, voting, comments, metrics
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
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const engagementRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [showEngagement, setShowEngagement] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [viewRecorded, setViewRecorded] = useState<number | null>(null);

  const mediaId = currentTrack?.id || 0;

  // Fetch media file data for engagement metrics
  const { data: mediaFile, refetch: refetchMedia } = trpc.media.getById.useQuery(
    { id: mediaId },
    { enabled: mediaId > 0 && isVideoTrack }
  );

  // Fetch comments
  const { data: comments, refetch: refetchComments } = trpc.comments.list.useQuery(
    { mediaFileId: mediaId },
    { enabled: mediaId > 0 && isVideoTrack }
  );

  // View tracking mutation
  const recordViewMutation = trpc.engagement.recordView.useMutation();

  // Comment mutation
  const commentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      toast.success("Comment posted!");
      setCommentText("");
      setReplyTo(null);
      refetchComments();
      refetchMedia();
    },
  });

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

  // Record view when video starts playing (once per track)
  useEffect(() => {
    if (mediaId > 0 && isVideoTrack && isPlaying && viewRecorded !== mediaId) {
      recordViewMutation.mutate({ mediaFileId: mediaId });
      setViewRecorded(mediaId);
    }
  }, [mediaId, isVideoTrack, isPlaying, viewRecorded]);

  // Reset engagement panel when track changes
  useEffect(() => {
    setShowEngagement(false);
    setCommentText("");
    setReplyTo(null);
  }, [mediaId]);

  // Don't render if not a video track
  if (!isVideoTrack || !currentTrack) {
    return null;
  }

  const handleClose = () => {
    stop();
  };

  const handleComment = () => {
    if (!user) {
      toast.error("Please log in to comment");
      return;
    }
    if (!commentText.trim()) {
      toast.error("Please enter a comment");
      return;
    }
    commentMutation.mutate({
      mediaFileId: mediaId,
      content: commentText,
      parentCommentId: replyTo || undefined,
    });
  };

  const topLevelComments = comments?.filter((c) => !c.parentCommentId) || [];

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
            : "inset-0 flex flex-col items-center bg-black/90 overflow-y-auto"
        }`}
      >
        {/* Controls overlay */}
        <div className={`absolute ${isMinimized ? "top-2 right-2" : "top-4 right-4"} z-10 flex gap-2`}>
          {/* Engagement toggle (only in maximized) */}
          {!isMinimized && (
            <Button
              variant="ghost"
              size="icon"
              className={`bg-black/50 hover:bg-black/70 text-white ${showEngagement ? "ring-2 ring-white/50" : ""}`}
              onClick={() => setShowEngagement(!showEngagement)}
              title="Toggle engagement panel"
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
          )}
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
        <div className={`relative ${isMinimized ? "w-full h-full" : "w-full max-w-5xl mt-12 flex-shrink-0"}`}>
          <video
            ref={videoRef}
            className={`${
              isMinimized
                ? "w-full h-full object-cover rounded-lg"
                : "w-full object-contain max-h-[65vh]"
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

        {/* Engagement section - only in maximized mode when toggled */}
        {!isMinimized && showEngagement && mediaFile && (
          <div
            ref={engagementRef}
            className="w-full max-w-5xl px-4 py-4 space-y-4 flex-shrink-0 mb-8"
          >
            {/* Title + Vote Buttons row */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-white text-lg font-semibold truncate">
                {currentTrack.title}
              </h2>
              <VoteButtons
                mediaFileId={mediaId}
                initialUpvotes={mediaFile.upvotes}
                initialDownvotes={mediaFile.downvotes}
                size="md"
              />
            </div>

            {/* Popularity Metrics */}
            <PopularityMetrics
              playCount={mediaFile.playCount}
              downloadCount={mediaFile.downloadCount}
              viewCount={mediaFile.viewCount}
              upvotes={mediaFile.upvotes}
              downvotes={mediaFile.downvotes}
              compact
              className="text-gray-300"
            />

            {/* Comments Section */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-3">
              <h3 className="text-white font-medium text-sm">
                Comments ({comments?.length || 0})
              </h3>

              {/* Comment Input */}
              <div className="flex gap-2">
                <Textarea
                  placeholder={replyTo ? "Write a reply..." : "Write a comment..."}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 text-sm resize-none"
                />
                <Button
                  onClick={handleComment}
                  disabled={commentMutation.isPending}
                  size="icon"
                  className="bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0 self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              {replyTo && (
                <div className="text-xs text-gray-400">
                  Replying to comment...{" "}
                  <button
                    className="text-purple-400 hover:text-purple-300 underline"
                    onClick={() => setReplyTo(null)}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Comments List */}
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {topLevelComments.map((comment) => {
                  const replies = comments?.filter((c) => c.parentCommentId === comment.id) || [];
                  return (
                    <div key={comment.id} className="border-l-2 border-white/20 pl-3">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {comment.userName?.charAt(0) || "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-xs text-white">{comment.userName || "User"}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(comment.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-gray-300 mb-1">{comment.content}</p>
                          <button
                            className="text-xs text-purple-400 hover:text-purple-300"
                            onClick={() => setReplyTo(comment.id)}
                          >
                            Reply
                          </button>

                          {/* Replies */}
                          {replies.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {replies.map((reply) => (
                                <div key={reply.id} className="flex items-start gap-2">
                                  <div className="w-5 h-5 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                    {reply.userName?.charAt(0) || "U"}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-medium text-[11px] text-white">{reply.userName || "User"}</span>
                                      <span className="text-[11px] text-gray-500">
                                        {new Date(reply.createdAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-gray-300">{reply.content}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {topLevelComments.length === 0 && (
                  <p className="text-center text-gray-500 py-4 text-sm">
                    No comments yet. Be the first to comment!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

