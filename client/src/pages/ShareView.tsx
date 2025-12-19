import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { FileAudio, FileVideo, Download, Loader2, AlertCircle } from "lucide-react";

export default function ShareView() {
  const [, params] = useRoute("/share/:token");
  const shareToken = params?.token || "";
  
  const { data: mediaFile, isLoading, error } = trpc.media.getByShareToken.useQuery(
    { shareToken },
    { enabled: !!shareToken }
  );
  
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
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="container max-w-4xl mx-auto py-12">
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
            )}
            
            {/* Lyrics */}
            {mediaFile.lyrics && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Lyrics</h3>
                <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-sm">
                  {mediaFile.lyrics}
                </div>
              </div>
            )}
            
            {/* Download Button */}
            {mediaFile.allowDownload && (
              <div className="flex justify-center">
                <Button 
                  size="lg"
                  onClick={() => window.open(mediaFile.fileUrl, '_blank')}
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download File
                </Button>
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
      </div>
    </div>
  );
}
