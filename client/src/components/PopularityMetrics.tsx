import { Play, Download, Eye, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PopularityMetricsProps {
  playCount: number;
  downloadCount: number;
  viewCount: number;
  upvotes: number;
  downvotes: number;
  compact?: boolean;
  className?: string;
}

/**
 * Format a number for display (e.g., 1000 -> 1K, 1000000 -> 1M)
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
 * PopularityMetrics component displays engagement statistics for a media file.
 * Shows play count, download count, view count, upvotes, and downvotes.
 * Supports compact mode for use in cards.
 * 
 * Requirements: 2.3, 3.3, 4.3
 */
export default function PopularityMetrics({
  playCount,
  downloadCount,
  viewCount,
  upvotes,
  downvotes,
  compact = false,
  className,
}: PopularityMetricsProps) {
  const metrics = [
    { icon: Play, value: playCount, label: "plays", color: "text-blue-500" },
    { icon: Download, value: downloadCount, label: "downloads", color: "text-green-500" },
    { icon: Eye, value: viewCount, label: "views", color: "text-purple-500" },
    { icon: ThumbsUp, value: upvotes, label: "upvotes", color: "text-emerald-500" },
    { icon: ThumbsDown, value: downvotes, label: "downvotes", color: "text-red-500" },
  ];

  if (compact) {
    // Compact mode: show only key metrics in a single line
    return (
      <div className={cn("flex items-center gap-3 text-xs text-muted-foreground", className)}>
        <span className="flex items-center gap-1" title={`${playCount} plays`}>
          <Play className="w-3 h-3 text-blue-500" />
          {formatCount(playCount)}
        </span>
        <span className="flex items-center gap-1" title={`${downloadCount} downloads`}>
          <Download className="w-3 h-3 text-green-500" />
          {formatCount(downloadCount)}
        </span>
        <span className="flex items-center gap-1" title={`${upvotes} upvotes`}>
          <ThumbsUp className="w-3 h-3 text-emerald-500" />
          {formatCount(upvotes)}
        </span>
      </div>
    );
  }

  // Full mode: show all metrics with labels
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-5 gap-4", className)}>
      {metrics.map(({ icon: Icon, value, label, color }) => (
        <div
          key={label}
          className="flex flex-col items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <Icon className={cn("w-5 h-5 mb-1", color)} />
          <span className="text-lg font-semibold tabular-nums">{formatCount(value)}</span>
          <span className="text-xs text-muted-foreground capitalize">{label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Inline variant for displaying metrics in a horizontal row
 */
export function PopularityMetricsInline({
  playCount,
  downloadCount,
  viewCount,
  upvotes,
  downvotes,
  className,
}: PopularityMetricsProps) {
  return (
    <div className={cn("flex items-center gap-4 text-sm text-muted-foreground", className)}>
      <span className="flex items-center gap-1.5" title={`${playCount} plays`}>
        <Play className="w-4 h-4 text-blue-500" />
        <span className="tabular-nums">{formatCount(playCount)}</span>
      </span>
      <span className="flex items-center gap-1.5" title={`${downloadCount} downloads`}>
        <Download className="w-4 h-4 text-green-500" />
        <span className="tabular-nums">{formatCount(downloadCount)}</span>
      </span>
      <span className="flex items-center gap-1.5" title={`${viewCount} views`}>
        <Eye className="w-4 h-4 text-purple-500" />
        <span className="tabular-nums">{formatCount(viewCount)}</span>
      </span>
      <span className="flex items-center gap-1.5" title={`${upvotes} upvotes`}>
        <ThumbsUp className="w-4 h-4 text-emerald-500" />
        <span className="tabular-nums">{formatCount(upvotes)}</span>
      </span>
      <span className="flex items-center gap-1.5" title={`${downvotes} downvotes`}>
        <ThumbsDown className="w-4 h-4 text-red-500" />
        <span className="tabular-nums">{formatCount(downvotes)}</span>
      </span>
    </div>
  );
}
