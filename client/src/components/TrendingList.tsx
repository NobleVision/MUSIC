import { useState } from "react";
import { TrendingUp, Play, Flame, Clock, Loader2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type TimePeriod = "24h" | "7d" | "30d" | "all";
type ListType = "trending" | "popular" | "hot";

interface TrendingListProps {
  defaultPeriod?: TimePeriod;
  defaultType?: ListType;
  limit?: number;
  showRank?: boolean;
  showPeriodSelector?: boolean;
  showTypeSelector?: boolean;
  onMediaClick?: (mediaFileId: number) => void;
  className?: string;
}

/**
 * Format a number for display (e.g., 1000 -> 1K)
 */
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Period options for the selector
 */
const PERIOD_OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

/**
 * List type options
 */
const TYPE_OPTIONS: { value: ListType; label: string; icon: typeof TrendingUp }[] = [
  { value: "trending", label: "Trending", icon: TrendingUp },
  { value: "popular", label: "Popular", icon: Play },
  { value: "hot", label: "Hot", icon: Flame },
];

/**
 * TrendingList component displays trending, popular, or hot media files.
 * Supports period selection and shows rank numbers.
 * 
 * Requirements: 5.2, 5.3
 */
export default function TrendingList({
  defaultPeriod = "24h",
  defaultType = "trending",
  limit = 10,
  showRank = true,
  showPeriodSelector = true,
  showTypeSelector = true,
  onMediaClick,
  className,
}: TrendingListProps) {
  const [period, setPeriod] = useState<TimePeriod>(defaultPeriod);
  const [listType, setListType] = useState<ListType>(defaultType);

  // Fetch trending data
  const { data: trendingData, isLoading: isTrendingLoading } = trpc.engagement.getTrending.useQuery(
    { limit },
    { enabled: listType === "trending" }
  );

  // Fetch popular data
  const { data: popularData, isLoading: isPopularLoading } = trpc.engagement.getPopular.useQuery(
    { period, limit },
    { enabled: listType === "popular" }
  );

  // Fetch hot data
  const { data: hotData, isLoading: isHotLoading } = trpc.engagement.getHot.useQuery(
    { limit },
    { enabled: listType === "hot" }
  );

  // Get the appropriate data based on list type
  const data = listType === "trending" ? trendingData : listType === "popular" ? popularData : hotData;
  const isLoading = listType === "trending" ? isTrendingLoading : listType === "popular" ? isPopularLoading : isHotLoading;

  // Get the icon for the current list type
  const TypeIcon = TYPE_OPTIONS.find((t) => t.value === listType)?.icon || TrendingUp;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <TypeIcon className="w-5 h-5 text-primary" />
            <CardTitle className="text-sm font-medium">
              {TYPE_OPTIONS.find((t) => t.value === listType)?.label || "Trending"}
            </CardTitle>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Type selector */}
            {showTypeSelector && (
              <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={listType === value ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setListType(value)}
                  >
                    <Icon className="w-3.5 h-3.5 mr-1" />
                    {label}
                  </Button>
                ))}
              </div>
            )}

            {/* Period selector (only for popular) */}
            {showPeriodSelector && listType === "popular" && (
              <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                {PERIOD_OPTIONS.map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={period === value ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setPeriod(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Music className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No media files found</p>
          </div>
        ) : (
          <ul className="divide-y">
            {data.map((item, index) => (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors",
                  onMediaClick && "cursor-pointer"
                )}
                onClick={() => onMediaClick?.(item.id)}
              >
                {/* Rank number */}
                {showRank && (
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
                      index === 0 && "bg-yellow-500/20 text-yellow-600",
                      index === 1 && "bg-gray-300/30 text-gray-600",
                      index === 2 && "bg-orange-500/20 text-orange-600",
                      index > 2 && "bg-muted text-muted-foreground"
                    )}
                  >
                    {index + 1}
                  </div>
                )}

                {/* Media info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Play className="w-3 h-3" />
                      {formatCount(item.playCount)} plays
                    </span>
                    {listType === "trending" && item.engagementVelocity !== undefined && (
                      <Badge variant="secondary" className="text-xs">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {item.engagementVelocity} today
                      </Badge>
                    )}
                    {listType === "hot" && (
                      <Badge variant="secondary" className="text-xs">
                        <Flame className="w-3 h-3 mr-1" />
                        {item.hotnessScore}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Vote counts */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-emerald-600">
                    👍 {formatCount(item.upvotes)}
                  </span>
                  <span className="flex items-center gap-1 text-red-500">
                    👎 {formatCount(item.downvotes)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact version of TrendingList for sidebar or smaller spaces
 */
export function TrendingListCompact({
  limit = 5,
  listType = "trending",
  onMediaClick,
  className,
}: {
  limit?: number;
  listType?: ListType;
  onMediaClick?: (mediaFileId: number) => void;
  className?: string;
}) {
  // Fetch data based on type
  const { data: trendingData, isLoading: isTrendingLoading } = trpc.engagement.getTrending.useQuery(
    { limit },
    { enabled: listType === "trending" }
  );

  const { data: popularData, isLoading: isPopularLoading } = trpc.engagement.getPopular.useQuery(
    { period: "24h", limit },
    { enabled: listType === "popular" }
  );

  const { data: hotData, isLoading: isHotLoading } = trpc.engagement.getHot.useQuery(
    { limit },
    { enabled: listType === "hot" }
  );

  const data = listType === "trending" ? trendingData : listType === "popular" ? popularData : hotData;
  const isLoading = listType === "trending" ? isTrendingLoading : listType === "popular" ? isPopularLoading : isHotLoading;

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn("text-center py-4 text-muted-foreground text-xs", className)}>
        No data available
      </div>
    );
  }

  return (
    <ul className={cn("space-y-1", className)}>
      {data.map((item, index) => (
        <li
          key={item.id}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors text-sm",
            onMediaClick && "cursor-pointer"
          )}
          onClick={() => onMediaClick?.(item.id)}
        >
          <span className="w-5 text-xs text-muted-foreground font-medium">{index + 1}.</span>
          <span className="flex-1 truncate">{item.title}</span>
          <span className="text-xs text-muted-foreground">{formatCount(item.playCount)}</span>
        </li>
      ))}
    </ul>
  );
}
