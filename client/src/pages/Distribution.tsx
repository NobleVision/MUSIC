import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export default function Distribution() {
  const [, params] = useRoute("/distribute/:id");
  const [, setLocation] = useLocation();
  const mediaId = params?.id ? parseInt(params.id) : 0;
  
  const [showComplianceDialog, setShowComplianceDialog] = useState(false);
  const [complianceChecks, setComplianceChecks] = useState({
    noVoiceImpersonation: false,
    humanContribution: false,
    originalContent: false,
    rightsOwnership: false,
    aiDisclosure: false,
  });
  
  // Distribution metadata state
  const [artistName, setArtistName] = useState("");
  const [artistBio, setArtistBio] = useState("");
  const [isrc, setIsrc] = useState("");
  const [upc, setUpc] = useState("");
  const [writerCredits, setWriterCredits] = useState("");
  const [isAiAssisted, setIsAiAssisted] = useState(false);
  const [genres, setGenres] = useState("");
  const [moods, setMoods] = useState("");
  
  const { data: mediaFile, refetch } = trpc.media.getById.useQuery(
    { id: mediaId },
    { enabled: mediaId > 0 }
  );
  
  const updateMutation = trpc.media.update.useMutation({
    onSuccess: () => {
      toast.success("Distribution metadata saved!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save metadata");
    },
  });
  
  // Load existing data
  useState(() => {
    if (mediaFile) {
      setArtistName(mediaFile.artistName || "");
      setArtistBio(mediaFile.artistBio || "");
      setIsrc(mediaFile.isrc || "");
      setUpc(mediaFile.upc || "");
      setWriterCredits(mediaFile.writerCredits || "");
      setIsAiAssisted(mediaFile.isAiAssisted || false);
      setGenres(mediaFile.genres || "");
      setMoods(mediaFile.moods || "");
    }
  });
  
  const handleSaveMetadata = () => {
    updateMutation.mutate({
      id: mediaId,
      artistName,
      artistBio,
      isrc: isrc || undefined,
      upc: upc || undefined,
      writerCredits: writerCredits || undefined,
      isAiAssisted,
      genres: genres || undefined,
      moods: moods || undefined,
    });
  };
  
  const handleProceedToDistribution = () => {
    if (!artistName.trim()) {
      toast.error("Artist name is required");
      return;
    }
    setShowComplianceDialog(true);
  };
  
  const allComplianceChecked = Object.values(complianceChecks).every(v => v);
  
  const handleDistribute = () => {
    if (!allComplianceChecked) {
      toast.error("Please review and accept all compliance requirements");
      return;
    }
    
    // Save metadata first
    handleSaveMetadata();
    
    toast.success("Distribution metadata prepared! Ready for export to distribution platforms.");
    setShowComplianceDialog(false);
  };
  
  if (!mediaFile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }
  
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
      
      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Distribution Metadata</h1>
          <p className="text-gray-600">
            Prepare your track for distribution to Spotify, Apple Music, and other platforms
          </p>
        </div>
        
        {/* Track Info */}
        <Card>
          <CardHeader>
            <CardTitle>Track Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {mediaFile.coverArtUrl && (
                <img 
                  src={mediaFile.coverArtUrl} 
                  alt={mediaFile.title}
                  className="w-20 h-20 rounded-lg object-cover"
                />
              )}
              <div>
                <h3 className="font-semibold text-lg">{mediaFile.title}</h3>
                {mediaFile.musicStyle && (
                  <p className="text-sm text-gray-600">{mediaFile.musicStyle}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Artist Information */}
        <Card>
          <CardHeader>
            <CardTitle>Artist Information</CardTitle>
            <CardDescription>Details about the artist or creator</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="artist-name">Artist Name *</Label>
              <Input
                id="artist-name"
                placeholder="Your artist name"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="artist-bio">Artist Bio</Label>
              <Textarea
                id="artist-bio"
                placeholder="Tell your story..."
                value={artistBio}
                onChange={(e) => setArtistBio(e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Track Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Track Metadata</CardTitle>
            <CardDescription>Additional information for distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="isrc">ISRC Code</Label>
                <Input
                  id="isrc"
                  placeholder="e.g., USRC17607839"
                  value={isrc}
                  onChange={(e) => setIsrc(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">International Standard Recording Code</p>
              </div>
              <div>
                <Label htmlFor="upc">UPC/EAN Code</Label>
                <Input
                  id="upc"
                  placeholder="e.g., 123456789012"
                  value={upc}
                  onChange={(e) => setUpc(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Universal Product Code</p>
              </div>
            </div>
            
            <div>
              <Label htmlFor="writer-credits">Writer Credits</Label>
              <Input
                id="writer-credits"
                placeholder="e.g., John Doe, Jane Smith"
                value={writerCredits}
                onChange={(e) => setWriterCredits(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="genres">Genres</Label>
              <Input
                id="genres"
                placeholder="e.g., Pop, Electronic, Rock"
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="moods">Moods</Label>
              <Input
                id="moods"
                placeholder="e.g., Energetic, Melancholic, Uplifting"
                value={moods}
                onChange={(e) => setMoods(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ai-assisted"
                checked={isAiAssisted}
                onCheckedChange={(checked) => setIsAiAssisted(checked as boolean)}
              />
              <label
                htmlFor="ai-assisted"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                This track was created with AI assistance
              </label>
            </div>
          </CardContent>
        </Card>
        
        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={handleSaveMetadata} variant="outline" disabled={updateMutation.isPending}>
            Save Metadata
          </Button>
          <Button onClick={handleProceedToDistribution} disabled={updateMutation.isPending}>
            <Upload className="w-4 h-4 mr-2" />
            Proceed to Distribution
          </Button>
        </div>
      </main>
      
      {/* Compliance Checklist Dialog */}
      <Dialog open={showComplianceDialog} onOpenChange={setShowComplianceDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Rights & Compliance Checklist
            </DialogTitle>
            <DialogDescription>
              Please review and confirm compliance with AI music distribution policies
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <p className="text-sm text-blue-900">
                  <strong>Important:</strong> Most streaming platforms now accept AI-generated music, 
                  but have strict rules about copyright, impersonation, and disclosure.
                </p>
              </CardContent>
            </Card>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="check-1"
                  checked={complianceChecks.noVoiceImpersonation}
                  onCheckedChange={(checked) => 
                    setComplianceChecks(prev => ({ ...prev, noVoiceImpersonation: checked as boolean }))
                  }
                />
                <div className="flex-1">
                  <label htmlFor="check-1" className="text-sm font-medium leading-none cursor-pointer">
                    No Voice Impersonation
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    I confirm this track does not clone or impersonate specific artists' voices without permission.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="check-2"
                  checked={complianceChecks.humanContribution}
                  onCheckedChange={(checked) => 
                    setComplianceChecks(prev => ({ ...prev, humanContribution: checked as boolean }))
                  }
                />
                <div className="flex-1">
                  <label htmlFor="check-2" className="text-sm font-medium leading-none cursor-pointer">
                    Meaningful Human Contribution
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    Per 2025 U.S. Copyright Office guidelines, I confirm meaningful human creative input 
                    (editing, arrangement, vocals, or production) to qualify for copyright protection.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="check-3"
                  checked={complianceChecks.originalContent}
                  onCheckedChange={(checked) => 
                    setComplianceChecks(prev => ({ ...prev, originalContent: checked as boolean }))
                  }
                />
                <div className="flex-1">
                  <label htmlFor="check-3" className="text-sm font-medium leading-none cursor-pointer">
                    Original Content
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    This track does not copy existing songs, melodies, or copyrighted material.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="check-4"
                  checked={complianceChecks.rightsOwnership}
                  onCheckedChange={(checked) => 
                    setComplianceChecks(prev => ({ ...prev, rightsOwnership: checked as boolean }))
                  }
                />
                <div className="flex-1">
                  <label htmlFor="check-4" className="text-sm font-medium leading-none cursor-pointer">
                    Rights Ownership
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    I own or have permission for all rights to distribute this track commercially.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="check-5"
                  checked={complianceChecks.aiDisclosure}
                  onCheckedChange={(checked) => 
                    setComplianceChecks(prev => ({ ...prev, aiDisclosure: checked as boolean }))
                  }
                />
                <div className="flex-1">
                  <label htmlFor="check-5" className="text-sm font-medium leading-none cursor-pointer">
                    AI Disclosure
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    I will properly disclose AI assistance where required by the distribution platform.
                  </p>
                </div>
              </div>
            </div>
            
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900 mb-1">Documentation Tip</p>
                    <p className="text-xs text-green-800">
                      Keep records of your prompts, edits, and creative process. This helps prove 
                      authorship if needed for copyright registration or label negotiations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplianceDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDistribute} 
              disabled={!allComplianceChecked}
            >
              Confirm & Prepare for Distribution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
