import { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Plus, Upload, Loader2, FileAudio, FileVideo, Shuffle } from "lucide-react";
import MediaFileCard from "@/components/MediaFileCard";
import MusicPlayerSpacer from "@/components/MusicPlayerSpacer";
import PageWrapper, { PageHeader } from "@/components/PageWrapper";
import { uploadToCloudinary } from "@/lib/storage";
import { useMusicPlayer } from "@/contexts/MusicPlayerContext";

export default function CategoryView() {
  const [, params] = useRoute("/category/:id");
  const [, setLocation] = useLocation();
  const categoryId = params?.id ? parseInt(params.id) : 0;
  const { playMediaFile } = useMusicPlayer();

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  
  // Upload form state
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [musicStyle, setMusicStyle] = useState("");
  const [mediaType, setMediaType] = useState<"audio" | "video">("audio");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [coverArtFile, setCoverArtFile] = useState<File | null>(null);
  
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const coverArtInputRef = useRef<HTMLInputElement>(null);
  
  const { data: category } = trpc.categories.list.useQuery(
    { sectionId: 0 },
    {
      enabled: false,
    }
  );
  
  const { data: mediaFiles, isLoading, refetch } = trpc.media.list.useQuery(
    { categoryId },
    { enabled: categoryId > 0 }
  );
  
  const createMediaMutation = trpc.media.create.useMutation({
    onSuccess: () => {
      toast.success("Media file uploaded successfully!");
      resetUploadForm();
      setShowUploadDialog(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload media file");
      setUploading(false);
    },
  });
  
  const shuffleMutation = trpc.media.getRandomFromCategory.useQuery(
    { categoryId },
    { enabled: false }
  );
  
  const resetUploadForm = () => {
    setTitle("");
    setLyrics("");
    setMusicStyle("");
    setMediaType("audio");
    setMediaFile(null);
    setCoverArtFile(null);
    setUploading(false);
    setUploadProgress("");
    if (mediaFileInputRef.current) mediaFileInputRef.current.value = "";
    if (coverArtInputRef.current) coverArtInputRef.current.value = "";
  };
  
  // Get upload signature mutation for direct Cloudinary uploads
  const getSignatureMutation = trpc.upload.getSignature.useMutation();

  const handleUpload = async () => {
    if (!mediaFile) {
      toast.error("Please select a media file");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setUploading(true);

    try {
      // Get signed upload parameters from server
      setUploadProgress("Preparing upload...");
      const mediaSignature = await getSignatureMutation.mutateAsync({
        filename: mediaFile.name,
        contentType: mediaFile.type,
        folder: 'media',
      });

      // Upload media file directly to Cloudinary (bypasses Vercel 4.5MB limit)
      setUploadProgress("Uploading media file... 0%");
      const mediaUploadResult = await uploadToCloudinary(
        mediaSignature,
        mediaFile,
        (percent) => setUploadProgress(`Uploading media file... ${percent}%`)
      );

      // Upload cover art if provided
      let coverArtKey = undefined;
      let coverArtUrl = undefined;
      if (coverArtFile) {
        setUploadProgress("Preparing cover art upload...");
        const coverSignature = await getSignatureMutation.mutateAsync({
          filename: coverArtFile.name,
          contentType: coverArtFile.type,
          folder: 'covers',
        });

        setUploadProgress("Uploading cover art... 0%");
        const coverUploadResult = await uploadToCloudinary(
          coverSignature,
          coverArtFile,
          (percent) => setUploadProgress(`Uploading cover art... ${percent}%`)
        );
        coverArtKey = coverUploadResult.key;
        coverArtUrl = coverUploadResult.url;
      }

      // Create media file record
      setUploadProgress("Creating record...");
      await createMediaMutation.mutateAsync({
        categoryId,
        title,
        filename: mediaFile.name,
        fileKey: mediaUploadResult.key,
        fileUrl: mediaUploadResult.url,
        fileSize: mediaFile.size,
        mimeType: mediaFile.type,
        mediaType,
        lyrics: lyrics || undefined,
        musicStyle: musicStyle || undefined,
        coverArtKey,
        coverArtUrl,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload failed. Please try again.");
      setUploading(false);
    }
  };
  
  const handleShuffle = async () => {
    const result = await shuffleMutation.refetch();
    if (result.data) {
      playMediaFile(result.data);
      toast.success(`Now playing: ${result.data.title}`);
    } else {
      toast.info("No media files available to shuffle");
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }
  
  return (
    <PageWrapper>
      {/* Header */}
      <PageHeader>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <FileAudio className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Category</h1>
                <p className="text-sm text-gray-500">Media files</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleShuffle}>
              <Shuffle className="w-4 h-4 mr-2" />
              Shuffle
            </Button>
          </div>
        </div>
      </PageHeader>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Media Files</h2>
            <p className="text-gray-600">Upload and manage your songs and videos</p>
          </div>
          <Button onClick={() => setShowUploadDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Upload Media
          </Button>
        </div>
        
        {mediaFiles && mediaFiles.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No media files yet</h3>
              <p className="text-gray-600 mb-4">
                Upload your first song or video to get started
              </p>
              <Button onClick={() => setShowUploadDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Upload Media
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {mediaFiles?.map((file) => (
              <MediaFileCard key={file.id} mediaFile={file} onUpdate={refetch} />
            ))}
          </div>
        )}
      </main>
      
      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        if (!uploading) {
          setShowUploadDialog(open);
          if (!open) resetUploadForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Media File</DialogTitle>
            <DialogDescription>
              Add a new song or video with metadata
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="media-type">Media Type</Label>
              <Select value={mediaType} onValueChange={(value: "audio" | "video") => setMediaType(value)} disabled={uploading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="media-file">Media File *</Label>
              <Input
                id="media-file"
                type="file"
                ref={mediaFileInputRef}
                accept={mediaType === "audio" ? "audio/*" : "video/*"}
                onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                disabled={uploading}
              />
            </div>
            
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enter song/video title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
              />
            </div>
            
            <div>
              <Label htmlFor="music-style">Music Style / Genre</Label>
              <Input
                id="music-style"
                placeholder="e.g., Pop, Rock, Electronic"
                value={musicStyle}
                onChange={(e) => setMusicStyle(e.target.value)}
                disabled={uploading}
              />
            </div>
            
            <div>
              <Label htmlFor="lyrics">Lyrics</Label>
              <Textarea
                id="lyrics"
                placeholder="Enter lyrics..."
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={4}
                disabled={uploading}
              />
            </div>
            
            <div>
              <Label htmlFor="cover-art">Cover Art / Album Art</Label>
              <Input
                id="cover-art"
                type="file"
                ref={coverArtInputRef}
                accept="image/*"
                onChange={(e) => setCoverArtFile(e.target.files?.[0] || null)}
                disabled={uploading}
              />
            </div>
            
            {uploading && (
              <div className="text-center text-sm text-gray-600">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                {uploadProgress}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MusicPlayerSpacer />
    </PageWrapper>
  );
}
