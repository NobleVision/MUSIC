import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface VoteButtonsProps {
  mediaFileId: number;
  initialUpvotes?: number;
  initialDownvotes?: number;
  size?: "sm" | "md" | "lg";
  showCounts?: boolean;
  className?: string;
}

/**
 * VoteButtons component for thumbs up/down voting on media files.
 * Supports loading states, animations on count changes, and vote toggling.
 * 
 * Requirements: 1.1, 1.2, 1.5, 7.3
 */
export default function VoteButtons({
  mediaFileId,
  initialUpvotes = 0,
  initialDownvotes = 0,
  size = "md",
  showCounts = true,
  className,
}: VoteButtonsProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [currentVote, setCurrentVote] = useState<"up" | "down" | null>(null);
  const [animatingUp, setAnimatingUp] = useState(false);
  const [animatingDown, setAnimatingDown] = useState(false);

  // Fetch current vote status
  const { data: voteStatus, isLoading: isLoadingStatus } = trpc.engagement.getVoteStatus.useQuery(
    { mediaFileId },
    { enabled: !!mediaFileId }
  );

  // Fetch vote counts
  const { data: voteCounts } = trpc.engagement.getVoteCounts.useQuery(
    { mediaFileId },
    { enabled: !!mediaFileId }
  );

  // Update local state when data is fetched
  useEffect(() => {
    if (voteStatus) {
      setCurrentVote(voteStatus.currentVote);
    }
  }, [voteStatus]);

  useEffect(() => {
    if (voteCounts) {
      // Animate if counts changed
      if (voteCounts.upvotes !== upvotes) {
        setAnimatingUp(true);
        setTimeout(() => setAnimatingUp(false), 300);
      }
      if (voteCounts.downvotes !== downvotes) {
        setAnimatingDown(true);
        setTimeout(() => setAnimatingDown(false), 300);
      }
      setUpvotes(voteCounts.upvotes);
      setDownvotes(voteCounts.downvotes);
    }
  }, [voteCounts]);

  // Vote mutation
  const voteMutation = trpc.engagement.vote.useMutation({
    onSuccess: (data) => {
      setCurrentVote(data.voteType as "up" | "down");
      setUpvotes(data.upvotes);
      setDownvotes(data.downvotes);
      
      // Trigger animation
      if (data.voteType === "up") {
        setAnimatingUp(true);
        setTimeout(() => setAnimatingUp(false), 300);
      } else {
        setAnimatingDown(true);
        setTimeout(() => setAnimatingDown(false), 300);
      }
    },
  });

  // Remove vote mutation
  const removeVoteMutation = trpc.engagement.removeVote.useMutation({
    onSuccess: (data) => {
      setCurrentVote(null);
      setUpvotes(data.upvotes);
      setDownvotes(data.downvotes);
    },
  });

  const isLoading = voteMutation.isPending || removeVoteMutation.isPending || isLoadingStatus;

  const handleVote = (voteType: "up" | "down") => {
    if (isLoading) return;

    // If clicking the same vote type, remove the vote
    if (currentVote === voteType) {
      removeVoteMutation.mutate({ mediaFileId });
    } else {
      // Otherwise, cast or change the vote
      voteMutation.mutate({ mediaFileId, voteType });
    }
  };

  // Size variants
  const sizeClasses = {
    sm: "h-7 px-2 text-xs gap-1",
    md: "h-8 px-3 text-sm gap-1.5",
    lg: "h-9 px-4 text-base gap-2",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Upvote button */}
      <Button
        variant={currentVote === "up" ? "default" : "outline"}
        size="sm"
        className={cn(
          sizeClasses[size],
          currentVote === "up" && "bg-green-600 hover:bg-green-700 text-white border-green-600",
          "transition-all duration-200"
        )}
        onClick={() => handleVote("up")}
        disabled={isLoading}
        aria-label={currentVote === "up" ? "Remove upvote" : "Upvote"}
        aria-pressed={currentVote === "up"}
      >
        <ThumbsUp
          className={cn(
            iconSizes[size],
            currentVote === "up" && "fill-current",
            animatingUp && "animate-bounce"
          )}
        />
        {showCounts && (
          <span
            className={cn(
              "tabular-nums transition-transform duration-200",
              animatingUp && "scale-125"
            )}
          >
            {upvotes}
          </span>
        )}
      </Button>

      {/* Downvote button */}
      <Button
        variant={currentVote === "down" ? "default" : "outline"}
        size="sm"
        className={cn(
          sizeClasses[size],
          currentVote === "down" && "bg-red-600 hover:bg-red-700 text-white border-red-600",
          "transition-all duration-200"
        )}
        onClick={() => handleVote("down")}
        disabled={isLoading}
        aria-label={currentVote === "down" ? "Remove downvote" : "Downvote"}
        aria-pressed={currentVote === "down"}
      >
        <ThumbsDown
          className={cn(
            iconSizes[size],
            currentVote === "down" && "fill-current",
            animatingDown && "animate-bounce"
          )}
        />
        {showCounts && (
          <span
            className={cn(
              "tabular-nums transition-transform duration-200",
              animatingDown && "scale-125"
            )}
          >
            {downvotes}
          </span>
        )}
      </Button>
    </div>
  );
}
