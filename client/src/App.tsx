import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MusicPlayerProvider } from "./contexts/MusicPlayerContext";
import MusicPlayer from "./components/MusicPlayer";
import VideoBackgroundOverlay from "./components/VideoBackgroundOverlay";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCallback, ReactNode } from "react";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SectionView from "./pages/SectionView";
import CategoryView from "./pages/CategoryView";
import MediaDetail from "./pages/MediaDetail";
import ShareView from "./pages/ShareView";
import Distribution from "./pages/Distribution";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/login" />;
  }
  
  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={Login} />
      <Route path="/share/:token" component={ShareView} />
      
      {/* Protected routes */}
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/section/:id">
        {() => <ProtectedRoute component={SectionView} />}
      </Route>
      <Route path="/category/:id">
        {() => <ProtectedRoute component={CategoryView} />}
      </Route>
      <Route path="/media/:id">
        {() => <ProtectedRoute component={MediaDetail} />}
      </Route>
      <Route path="/distribute/:id">
        {() => <ProtectedRoute component={Distribution} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      
      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Wrapper component that provides play tracking via engagement.recordPlay
 * Requirements: 2.1 - Track play count when playback completes or reaches threshold
 */
function MusicPlayerWithEngagement({ children }: { children: ReactNode }) {
  const recordPlayMutation = trpc.engagement.recordPlay.useMutation();

  const handlePlayRecorded = useCallback((mediaFileId: number, playDuration: number) => {
    recordPlayMutation.mutate({ mediaFileId, playDuration });
  }, [recordPlayMutation]);

  return (
    <MusicPlayerProvider onPlayRecorded={handlePlayRecorded}>
      {children}
    </MusicPlayerProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <MusicPlayerWithEngagement>
          <TooltipProvider>
            <Toaster />
            <VideoBackgroundOverlay />
            <Router />
            <MusicPlayer />
          </TooltipProvider>
        </MusicPlayerWithEngagement>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
