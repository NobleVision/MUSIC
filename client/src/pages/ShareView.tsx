import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { FileAudio, FileVideo, Download, Loader2, AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";
import VoteButtons from "@/components/VoteButtons";
import PopularityMetrics from "@/components/PopularityMetrics";

export default function ShareView() {
  const [, params] = useRoute("/share/:token");
  const shareToken = params?.token || "";
  const { user } = useAuth();

  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const { data: mediaFile, isLoading, error, refetch: refetchMedia } = trpc.media.getByShareToken.useQuery(
    { shareToken },
    { enabled: !!shareToken }
  );

  const mediaId = mediaFile?.id || 0;

  // Fetch comments
  const { data: comments, refetch: refetchComments } = trpc.comments.list.useQuery(
    { mediaFileId: mediaId },
    { enabled: mediaId > 0 }
  );

  // Record view on page load (exactly once)
  const hasRecordedViewRef = useRef(false);
  const recordViewMutation = trpc.engagement.recordView.useMutation({
    onSuccess: () => refetchMedia(),
  });
  useEffect(() => {
    if (mediaId > 0 && !hasRecordedViewRef.current) {
      hasRecordedViewRef.current = true;
      recordViewMutation.mutate({ mediaFileId: mediaId });
    }
  }, [mediaId]);

  // Play tracking
  const PLAY_THRESHOLD_SECONDS = 30;
  const PLAY_THRESHOLD_PERCENTAGE = 0.5;
  const playStartTimeRef = useRef(0);
  const hasRecordedPlayRef = useRef(false);
  const recordPlayMutation = trpc.engagement.recordPlay.useMutation({
    onSuccess: () => refetchMedia(),
  });

  const handlePlay = () => {
    playStartTimeRef.current = 0;
    hasRecordedPlayRef.current = false;
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) => {
    if (hasRecordedPlayRef.current) return;
    const el = e.currentTarget;
    const elapsed = el.currentTime;
    const duration = el.duration || 0;
    if (
      elapsed >= PLAY_THRESHOLD_SECONDS ||
      (duration > 0 && elapsed / duration >= PLAY_THRESHOLD_PERCENTAGE)
    ) {
      hasRecordedPlayRef.current = true;
      recordPlayMutation.mutate({ mediaFileId: mediaId, playDuration: Math.round(elapsed) });
    }
  };

  const handleEnded = (e: React.SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) => {
    if (hasRecordedPlayRef.current) return;
    const el = e.currentTarget;
    hasRecordedPlayRef.current = true;
    recordPlayMutation.mutate({ mediaFileId: mediaId, playDuration: Math.round(el.duration || 0) });
  };

  // Record download
  const recordDownloadMutation = trpc.engagement.recordDownload.useMutation({
    onSuccess: () => refetchMedia(),
  });

  const handleDownload = () => {
    if (mediaFile) {
      recordDownloadMutation.mutate({ mediaFileId: mediaId });
      window.open(mediaFile.fileUrl, '_blank');
    }
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error || !mediaFile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">File Not Found</h3>
            <p className="text-gray-600">
              This file is not available or the link has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Icon = mediaFile.mediaType === "audio" ? FileAudio : FileVideo;
  const topLevelComments = comments?.filter(c => !c.parentCommentId) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="container max-w-4xl mx-auto py-12 space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {mediaFile.coverArtUrl ? (
                <img
                  src={mediaFile.coverArtUrl}
                  alt={mediaFile.title}
                  className="w-48 h-48 rounded-lg object-cover shadow-lg"
                />
              ) : (
                <div className="w-48 h-48 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
                  <Icon className="w-24 h-24 text-white" />
                </div>
              )}
            </div>
            <CardTitle className="text-3xl">{mediaFile.title}</CardTitle>
            {mediaFile.musicStyle && (
              <CardDescription className="text-lg">{mediaFile.musicStyle}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Media Player */}
            {mediaFile.allowStreaming && (
              <div className="bg-gray-100 rounded-lg p-4">
                {mediaFile.mediaType === "audio" ? (
                  <audio controls className="w-full" onPlay={handlePlay} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded}>
                    <source src={mediaFile.fileUrl} type={mediaFile.mimeType || "audio/mpeg"} />
                    Your browser does not support the audio element.
                  </audio>
                ) : (
                  <video controls className="w-full rounded-lg" onPlay={handlePlay} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded}>
                    <source src={mediaFile.fileUrl} type={mediaFile.mimeType || "video/mp4"} />
                    Your browser does not support the video element.
                  </video>
                )}
              </div>
            )}

            {/* Vote Buttons */}
            <div className="flex justify-center">
              <VoteButtons
                mediaFileId={mediaId}
                initialUpvotes={mediaFile.upvotes}
                initialDownvotes={mediaFile.downvotes}
                size="md"
              />
            </div>

            {/* Download Button */}
            {mediaFile.allowDownload && (
              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={handleDownload}
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download File
                </Button>
              </div>
            )}

            {/* Popularity Metrics */}
            <PopularityMetrics
              playCount={mediaFile.playCount}
              downloadCount={mediaFile.downloadCount}
              viewCount={mediaFile.viewCount}
              upvotes={mediaFile.upvotes}
              downvotes={mediaFile.downvotes}
              compact
            />

            {/* Lyrics */}
            {mediaFile.lyrics && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Lyrics</h3>
                <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-sm">
                  {mediaFile.lyrics}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="border-t pt-4 text-sm text-gray-600">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-medium">Type:</span> {mediaFile.mediaType === "audio" ? "Audio" : "Video"}
                </div>
                {mediaFile.artistName && (
                  <div>
                    <span className="font-medium">Artist:</span> {mediaFile.artistName}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Card>
          <CardHeader>
            <CardTitle>Comments ({comments?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Comment Input */}
            {user ? (
              <>
                <div className="flex gap-2">
                  <Textarea
                    placeholder={replyTo ? "Write a reply..." : "Write a comment..."}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                  />
                  <Button onClick={handleComment} disabled={commentMutation.isPending}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                {replyTo && (
                  <div className="text-sm text-gray-600">
                    Replying to comment...{" "}
                    <Button size="sm" variant="link" onClick={() => setReplyTo(null)}>Cancel</Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Log in to leave a comment</p>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-4">
              {topLevelComments.map((comment) => {
                const replies = comments?.filter(c => c.parentCommentId === comment.id) || [];
                return (
                  <div key={comment.id} className="border-l-2 border-gray-200 pl-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {comment.userName?.charAt(0) || "U"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{comment.userName || "User"}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{comment.content}</p>
                        {user && (
                          <Button
                            size="sm"
                            variant="link"
                            className="h-auto p-0 text-xs"
                            onClick={() => setReplyTo(comment.id)}
                          >
                            Reply
                          </Button>
                        )}

                        {/* Replies */}
                        {replies.length > 0 && (
                          <div className="mt-3 space-y-3">
                            {replies.map((reply) => (
                              <div key={reply.id} className="flex items-start gap-2">
                                <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                  {reply.userName?.charAt(0) || "U"}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-xs">{reply.userName || "User"}</span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(reply.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-700">{reply.content}</p>
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
                <p className="text-center text-gray-500 py-8">No comments yet. Be the first to comment!</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
