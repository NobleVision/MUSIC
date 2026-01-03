import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Plus, Copy, Key, Loader2 } from "lucide-react";
import PageWrapper, { PageHeader } from "@/components/PageWrapper";
import MusicPlayerSpacer from "@/components/MusicPlayerSpacer";

export default function Settings() {
  const [, setLocation] = useLocation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  
  const { data: apiKeys, isLoading, refetch } = trpc.apiKeys.list.useQuery();
  
  const createKeyMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      toast.success("API key created successfully!");
      setGeneratedKey(data.apiKey);
      setNewKeyName("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create API key");
    },
  });
  
  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }
    createKeyMutation.mutate({ name: newKeyName });
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };
  
  const closeDialog = () => {
    setShowCreateDialog(false);
    setGeneratedKey("");
    setNewKeyName("");
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
      <PageHeader>
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </PageHeader>
      
      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your API keys and integrations</p>
        </div>
        
        {/* API Keys Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Create API keys for external tool integrations (e.g., Suno AI downloader)
                </CardDescription>
              </div>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create API Key
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {apiKeys && apiKeys.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Key className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No API keys yet. Create one to enable external integrations.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys?.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{key.name}</h4>
                      <p className="text-sm text-gray-500">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsedAt && (
                          <> · Last used {new Date(key.lastUsedAt).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${key.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                        {key.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* API Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>API Documentation</CardTitle>
            <CardDescription>How to use the external API endpoints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Export to Dashboard Endpoint</h4>
              <code className="block bg-gray-100 p-3 rounded text-sm">
                POST {window.location.origin}/api/external/export-to-dashboard
              </code>
              <p className="text-sm text-gray-600 mt-2">
                Send files from external tools to your dashboard. Include your API key in the <code>X-API-Key</code> header.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">List Sections</h4>
              <code className="block bg-gray-100 p-3 rounded text-sm">
                GET {window.location.origin}/api/external/sections
              </code>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">List Categories</h4>
              <code className="block bg-gray-100 p-3 rounded text-sm">
                GET {window.location.origin}/api/external/categories/:sectionId
              </code>
            </div>
          </CardContent>
        </Card>
      </main>
      
      {/* Create API Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => !generatedKey && setShowCreateDialog(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              {generatedKey ? "Save this API key - it won't be shown again!" : "Create a new API key for external integrations"}
            </DialogDescription>
          </DialogHeader>
          
          {generatedKey ? (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  ⚠️ Important: Copy this key now!
                </p>
                <p className="text-xs text-yellow-700">
                  This is the only time you'll see this key. Store it securely.
                </p>
              </div>
              
              <div>
                <Label>Your API Key</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={generatedKey}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button onClick={() => copyToClipboard(generatedKey)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="key-name">API Key Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g., Suno AI Downloader"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            {generatedKey ? (
              <Button onClick={closeDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateKey} disabled={createKeyMutation.isPending}>
                  {createKeyMutation.isPending ? "Creating..." : "Create Key"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MusicPlayerSpacer />
    </PageWrapper>
  );
}
