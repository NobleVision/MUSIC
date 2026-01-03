import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, FolderOpen, Music, LogOut, Settings, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import SectionCard from "@/components/SectionCard";
import MusicPlayerSpacer from "@/components/MusicPlayerSpacer";
import PageWrapper, { PageHeader } from "@/components/PageWrapper";
import ActivityFeed from "@/components/ActivityFeed";
import TrendingList from "@/components/TrendingList";

const ACTIVITY_FEED_COLLAPSED_KEY = "activity-feed-collapsed";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [showNewSectionDialog, setShowNewSectionDialog] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionDescription, setNewSectionDescription] = useState("");
  
  // Activity feed collapsed state - persisted to localStorage
  const [activityFeedCollapsed, setActivityFeedCollapsed] = useState(() => {
    const saved = localStorage.getItem(ACTIVITY_FEED_COLLAPSED_KEY);
    return saved === "true";
  });

  // Persist collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(ACTIVITY_FEED_COLLAPSED_KEY, String(activityFeedCollapsed));
  }, [activityFeedCollapsed]);
  
  const { data: sections, isLoading, refetch } = trpc.sections.list.useQuery();
  
  const createSectionMutation = trpc.sections.create.useMutation({
    onSuccess: () => {
      toast.success("Section created successfully!");
      setShowNewSectionDialog(false);
      setNewSectionName("");
      setNewSectionDescription("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create section");
    },
  });
  
  const handleCreateSection = () => {
    if (!newSectionName.trim()) {
      toast.error("Section name is required");
      return;
    }
    createSectionMutation.mutate({
      name: newSectionName,
      description: newSectionDescription,
    });
  };
  
  const handleLogout = () => {
    logout();
    setLocation("/login");
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Music Hosting Platform</h1>
              <p className="text-sm text-gray-500">Manage your music library</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/settings")}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </PageHeader>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Activity Feed - Collapsible panel at top */}
        <div className="mb-6">
          <ActivityFeed
            maxItems={15}
            collapsible
            defaultCollapsed={activityFeedCollapsed}
            showHeader
          />
        </div>

        {/* Trending/Popular/Hot Section */}
        <div className="mb-6">
          <TrendingList
            defaultType="trending"
            defaultPeriod="24h"
            limit={10}
            showRank
            showTypeSelector
            showPeriodSelector
            onMediaClick={(mediaFileId) => setLocation(`/media/${mediaFileId}`)}
          />
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Sections</h2>
            <p className="text-gray-600">Organize your music into sections and categories</p>
          </div>
          <Button onClick={() => setShowNewSectionDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Section
          </Button>
        </div>
        
        {sections && sections.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FolderOpen className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No sections yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first section to start organizing your music
              </p>
              <Button onClick={() => setShowNewSectionDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Section
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sections?.map((section) => (
              <SectionCard key={section.id} section={section} onUpdate={refetch} />
            ))}
          </div>
        )}
      </main>
      
      {/* New Section Dialog */}
      <Dialog open={showNewSectionDialog} onOpenChange={setShowNewSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Section</DialogTitle>
            <DialogDescription>
              Add a new section to organize your music library
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="section-name">Section Name</Label>
              <Input
                id="section-name"
                placeholder="e.g., Family, Work, Testing"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="section-description">Description (Optional)</Label>
              <Textarea
                id="section-description"
                placeholder="Describe this section..."
                value={newSectionDescription}
                onChange={(e) => setNewSectionDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSectionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSection} disabled={createSectionMutation.isPending}>
              {createSectionMutation.isPending ? "Creating..." : "Create Section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MusicPlayerSpacer />
    </PageWrapper>
  );
}
