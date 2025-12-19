import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileAudio, FileVideo, MoreVertical, Trash2, Share2, Eye, Download } from "lucide-react";
import type { MediaFile } from "../../../drizzle/schema";

interface MediaFileCardProps {
  mediaFile: MediaFile;
  onUpdate: () => void;
}

export default function MediaFileCard({ mediaFile, onUpdate }: MediaFileCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  
  const deleteMutation = trpc.media.delete.useMutation({
    onSuccess: () => {
      toast.success("Media file deleted successfully!");
      setShowDeleteDialog(false);
      onUpdate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete media file");
    },
  });
  
  const updateMutation = trpc.media.update.useMutation({
    onSuccess: () => {
      toast.success("Sharing settings updated!");
      setShowShareDialog(false);
      onUpdate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update settings");
    },
  });
  
  const handleDelete = () => {
    deleteMutation.mutate({ id: mediaFile.id });
  };
  
  const handleToggleSharing = () => {
    updateMutation.mutate({
      id: mediaFile.id,
      isPubliclyShared: !mediaFile.isPubliclyShared,
    });
  };
  
  const shareUrl = mediaFile.shareToken 
    ? `${window.location.origin}/share/${mediaFile.shareToken}`
    : "";
  
  const copyShareLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard!");
    }
  };
  
  const Icon = mediaFile.mediaType === "audio" ? FileAudio : FileVideo;
  
  return (
    <>
      <Card className="hover:shadow-lg transition-shadow group">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1">
              {mediaFile.coverArtUrl ? (
                <img 
                  src={mediaFile.coverArtUrl} 
                  alt={mediaFile.title}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-400 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate">{mediaFile.title}</CardTitle>
                {mediaFile.musicStyle && (
                  <CardDescription className="truncate">{mediaFile.musicStyle}</CardDescription>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => window.open(mediaFile.fileUrl, '_blank')}>
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(mediaFile.fileUrl, '_blank')}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            {mediaFile.lyrics && (
              <p className="line-clamp-2">{mediaFile.lyrics}</p>
            )}
            <div className="flex items-center justify-between text-xs">
              <span>{mediaFile.mediaType === "audio" ? "Audio" : "Video"}</span>
              {mediaFile.isPubliclyShared && (
                <span className="text-green-600 font-medium">Shared</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Media File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{mediaFile.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Media File</DialogTitle>
            <DialogDescription>
              Create a public link to share this file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Public Sharing</span>
              <Button 
                variant={mediaFile.isPubliclyShared ? "default" : "outline"}
                size="sm"
                onClick={handleToggleSharing}
                disabled={updateMutation.isPending}
              >
                {mediaFile.isPubliclyShared ? "Enabled" : "Disabled"}
              </Button>
            </div>
            
            {mediaFile.isPubliclyShared && shareUrl && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Share Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border rounded-md text-sm bg-gray-50"
                  />
                  <Button size="sm" onClick={copyShareLink}>
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
