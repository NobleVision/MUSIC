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

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <MusicPlayerProvider>
          <TooltipProvider>
            <Toaster />
            <VideoBackgroundOverlay />
            <Router />
            <MusicPlayer />
          </TooltipProvider>
        </MusicPlayerProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
