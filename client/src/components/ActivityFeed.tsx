import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Download, Upload, MessageSquare, ThumbsUp, ChevronDown, ChevronUp, X, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type ActivityType = "play" | "download" | "view" | "upload" | "comment" | "vote";

interface ActivityItem {
  id: number;
  activityType: ActivityType;
  mediaFileId: number | null;
  mediaTitle: string | null;
  location: string | null;
  createdAt: Date | string;
}

interface SSEActivityEvent {
  type: ActivityType;
  mediaFileId: number;
  mediaTitle: string;
  location?: string;
  timestamp: string;
}

interface ActivityFeedProps {
  maxItems?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  showHeader?: boolean;
  className?: string;
}

/**
 * Get the icon for an activity type
 */
function getActivityIcon(type: ActivityType) {
  switch (type) {
    case "play":
      return <Play className="w-4 h-4 text-blue-500" />;
    case "download":
      return <Download className="w-4 h-4 text-green-500" />;
    case "upload":
      return <Upload className="w-4 h-4 text-purple-500" />;
    case "comment":
      return <MessageSquare className="w-4 h-4 text-orange-500" />;
    case "vote":
      return <ThumbsUp className="w-4 h-4 text-emerald-500" />;
    case "view":
      return <Play className="w-4 h-4 text-gray-500" />;
    default:
      return <Radio className="w-4 h-4 text-gray-500" />;
  }
}

/**
 * Get the activity message text
 */
function getActivityMessage(item: ActivityItem): string {
  const location = item.location ? ` from ${item.location}` : "";
  const title = item.mediaTitle || "Unknown";
  
  switch (item.activityType) {
    case "play":
      return `Someone${location} is listening to "${title}"`;
    case "download":
      return `Someone${location} downloaded "${title}"`;
    case "upload":
      return `New upload: "${title}"`;
    case "comment":
      return `New comment on "${title}"`;
    case "vote":
      return `Someone${location} voted on "${title}"`;
    case "view":
      return `Someone${location} viewed "${title}"`;
    default:
      return `Activity on "${title}"`;
  }
}

/**
 * Format relative time (e.g., "2m ago", "1h ago")
 */
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

/**
 * ActivityFeed component displays recent platform activity in real-time.
 * Connects to SSE for live updates and supports collapsible UI.
 * 
 * Requirements: 6.5, 7.1, 7.2, 7.4
 */
export default function ActivityFeed({
  maxItems = 20,
  collapsible = true,
  defaultCollapsed = false,
  showHeader = true,
  className,
}: ActivityFeedProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isDismissed, setIsDismissed] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial activity data
  const { data: initialData, isLoading } = trpc.engagement.getRecentActivity.useQuery(
    { limit: maxItems },
    { enabled: !isDismissed }
  );

  // Update activities when initial data loads
  useEffect(() => {
    if (initialData) {
      setActivities(initialData as ActivityItem[]);
    }
  }, [initialData]);

  // Connect to SSE for real-time updates
  const connectSSE = useCallback(() => {
    if (isDismissed) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource("/api/activity-stream");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log("[ActivityFeed] SSE connected");
      };

      eventSource.addEventListener("activity", (event) => {
        try {
          const data: SSEActivityEvent = JSON.parse(event.data);
          
          // Create a new activity item from SSE event
          const newActivity: ActivityItem = {
            id: Date.now(), // Temporary ID for SSE events
            activityType: data.type,
            mediaFileId: data.mediaFileId,
            mediaTitle: data.mediaTitle,
            location: data.location || null,
            createdAt: data.timestamp,
          };

          setActivities((prev) => {
            // Add new activity at the beginning, limit to maxItems
            const updated = [newActivity, ...prev].slice(0, maxItems);
            return updated;
          });
        } catch (err) {
          console.error("[ActivityFeed] Failed to parse SSE event:", err);
        }
      });

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        
        // Attempt to reconnect after 5 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[ActivityFeed] Attempting to reconnect...");
          connectSSE();
        }, 5000);
      };
    } catch (err) {
      console.error("[ActivityFeed] Failed to connect SSE:", err);
      setIsConnected(false);
    }
  }, [isDismissed, maxItems]);

  // Setup SSE connection
  useEffect(() => {
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectSSE]);

  // Don't render if dismissed
  if (isDismissed) {
    return null;
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {showHeader && (
        <CardHeader className="py-3 px-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Live Activity</CardTitle>
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className={cn(
                  "text-xs",
                  isConnected && "bg-green-500 hover:bg-green-600"
                )}
              >
                {isConnected ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-1" />
                    Live
                  </>
                ) : (
                  "Offline"
                )}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              {collapsible && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  aria-label={isCollapsed ? "Expand activity feed" : "Collapse activity feed"}
                >
                  {isCollapsed ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsDismissed(true)}
                aria-label="Dismiss activity feed"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      )}

      {!isCollapsed && (
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No recent activity
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <ul className="divide-y">
                {activities.map((activity, index) => (
                  <li
                    key={`${activity.id}-${index}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    <div className="mt-0.5">{getActivityIcon(activity.activityType)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{getActivityMessage(activity)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(activity.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
