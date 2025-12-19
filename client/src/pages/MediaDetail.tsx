import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Star, Send, Tag, Plus, Loader2, FileAudio, FileVideo } from "lucide-react";

export default function MediaDetail() {
  const [, params] = useRoute("/media/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const mediaId = params?.id ? parseInt(params.id) : 0;
  
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  
  const { data: mediaFile, refetch: refetchMedia } = trpc.media.getById.useQuery(
    { id: mediaId },
    { enabled: mediaId > 0 }
  );
  
  const { data: averageRating } = trpc.ratings.getAverage.useQuery(
    { mediaFileId: mediaId },
    { enabled: mediaId > 0 }
  );
  
  const { data: userRating } = trpc.ratings.getUserRating.useQuery(
    { mediaFileId: mediaId },
    { enabled: mediaId > 0 && !!user }
  );
  
  const { data: comments, refetch: refetchComments } = trpc.comments.list.useQuery(
    { mediaFileId: mediaId },
    { enabled: mediaId > 0 }
  );
  
  const { data: tags, refetch: refetchTags } = trpc.tags.getForMedia.useQuery(
    { mediaFileId: mediaId },
    { enabled: mediaId > 0 }
  );
  
  const { data: allTags } = trpc.tags.list.useQuery();
  
  const rateMutation = trpc.ratings.rate.useMutation({
    onSuccess: () => {
      toast.success("Rating submitted!");
      refetchMedia();
    },
  });
  
  const commentMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      toast.success("Comment posted!");
      setCommentText("");
      setReplyTo(null);
      refetchComments();
    },
  });
  
  const createTagMutation = trpc.tags.create.useMutation({
    onSuccess: (data) => {
      if (data.tagId) {
        addTagMutation.mutate({ mediaFileId: mediaId, tagId: data.tagId });
      }
    },
  });
  
  const addTagMutation = trpc.tags.addToMedia.useMutation({
    onSuccess: () => {
      toast.success("Tag added!");
      setNewTagName("");
      setShowTagInput(false);
      refetchTags();
    },
  });
  
  const removeTagMutation = trpc.tags.removeFromMedia.useMutation({
    onSuccess: () => {
      toast.success("Tag removed!");
      refetchTags();
    },
  });
  
  const handleRate = (rating: number) => {
    if (!user) {
      toast.error("Please log in to rate");
      return;
    }
    rateMutation.mutate({ mediaFileId: mediaId, rating });
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
  
  const handleAddTag = () => {
    if (!user) {
      toast.error("Please log in to add tags");
      return;
    }
    if (!newTagName.trim()) {
      toast.error("Please enter a tag name");
      return;
    }
    createTagMutation.mutate({ name: newTagName });
  };
  
  const handleRemoveTag = (tagId: number) => {
    if (!user) {
      toast.error("Please log in to remove tags");
      return;
    }
    removeTagMutation.mutate({ mediaFileId: mediaId, tagId });
  };
  
  if (!mediaFile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }
  
  const Icon = mediaFile.mediaType === "audio" ? FileAudio : FileVideo;
  const topLevelComments = comments?.filter(c => !c.parentCommentId) || [];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>
      
      <main className="container max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Media Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-6">
              {mediaFile.coverArtUrl ? (
                <img 
                  src={mediaFile.coverArtUrl} 
                  alt={mediaFile.title}
                  className="w-32 h-32 rounded-lg object-cover"
                />
              ) : (
                <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <Icon className="w-16 h-16 text-white" />
                </div>
              )}
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">{mediaFile.title}</CardTitle>
                {mediaFile.musicStyle && (
                  <CardDescription className="text-lg mb-4">{mediaFile.musicStyle}</CardDescription>
                )}
                
                {/* Rating Display */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRate(star)}
                        className="transition-colors"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            (userRating?.rating || 0) >= star
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {averageRating && averageRating.count > 0 && (
                    <span className="text-sm text-gray-600">
                      {Number(averageRating.average).toFixed(1)} ({averageRating.count} ratings)
                    </span>
                  )}
                </div>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-2 items-center">
                  <Tag className="w-4 h-4 text-gray-500" />
                  {tags?.map((tag) => (
                    <Badge 
                      key={tag.id} 
                      variant="secondary"
                      className="cursor-pointer hover:bg-red-100"
                      onClick={() => handleRemoveTag(tag.id)}
                    >
                      {tag.name} ×
                    </Badge>
                  ))}
                  {showTagInput ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Tag name"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        className="w-32 h-7 text-sm"
                      />
                      <Button size="sm" onClick={handleAddTag} className="h-7">
                        Add
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowTagInput(false)} className="h-7">
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setShowTagInput(true)}
                      className="h-7"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Tag
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Media Player */}
            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              {mediaFile.mediaType === "audio" ? (
                <audio controls className="w-full">
                  <source src={mediaFile.fileUrl} type={mediaFile.mimeType || "audio/mpeg"} />
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <video controls className="w-full rounded-lg">
                  <source src={mediaFile.fileUrl} type={mediaFile.mimeType || "video/mp4"} />
                  Your browser does not support the video element.
                </video>
              )}
            </div>
            
            {/* Lyrics */}
            {mediaFile.lyrics && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Lyrics</h3>
                <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-sm">
                  {mediaFile.lyrics}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Comments Section */}
        <Card>
          <CardHeader>
            <CardTitle>Comments ({comments?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Comment Input */}
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
                Replying to comment... <Button size="sm" variant="link" onClick={() => setReplyTo(null)}>Cancel</Button>
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
                        <Button 
                          size="sm" 
                          variant="link" 
                          className="h-auto p-0 text-xs"
                          onClick={() => setReplyTo(comment.id)}
                        >
                          Reply
                        </Button>
                        
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
      </main>
    </div>
  );
}
