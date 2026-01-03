# Implementation Plan: Social Engagement Features

## Overview

This implementation plan breaks down the social engagement feature into discrete coding tasks. Each task builds on previous work, ensuring incremental progress with no orphaned code. The implementation follows a database-first approach, then backend APIs, then frontend components.

## Tasks

- [x] 1. Database schema extensions for engagement tracking
  - [x] 1.1 Add engagement columns to mediaFiles table
    - Add playCount, downloadCount, viewCount, upvotes, downvotes, hotnessScore columns
    - Add lastHotnessUpdate timestamp column
    - Create migration file
    - _Requirements: 2.3, 3.3, 4.3, 5.1_

  - [x] 1.2 Create votes table and enum
    - Add voteTypeEnum ("up", "down")
    - Create votes table with id, mediaFileId, ipHash, sessionId, voteType, timestamps
    - Add indexes for mediaFileId and ipHash
    - Add unique constraint on (mediaFileId, ipHash)
    - _Requirements: 1.4, 1.6_

  - [x] 1.3 Create event log tables
    - Create playLogs table with id, mediaFileId, ipHash, sessionId, playDuration, completedAt
    - Create downloadLogs table with id, mediaFileId, ipHash, downloadedAt
    - Create viewLogs table with id, mediaFileId, ipHash, viewedAt
    - Add appropriate indexes for time-based queries
    - _Requirements: 2.2, 3.2, 4.2_

  - [x] 1.4 Create activity feed table
    - Add activityTypeEnum ("play", "download", "view", "upload", "comment", "vote")
    - Create activityFeed table with id, activityType, mediaFileId, mediaTitle, ipHash, location, metadata, createdAt
    - Add indexes for createdAt and activityType
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 1.5 Run database migration
    - Generate migration with drizzle-kit
    - Apply migration to database
    - Verify schema changes
    - _Requirements: All database requirements_

- [x] 2. Backend utility functions
  - [x] 2.1 Create IP hashing utility
    - Implement hashIP function using SHA-256
    - Extract client IP from request headers (X-Forwarded-For, X-Real-IP, or socket)
    - Create getClientIpHash helper for tRPC context
    - _Requirements: 8.3_

  - [x] 2.2 Write property test for IP hashing
    - **Property 13: IP Hashing for Privacy**
    - Test that hash is deterministic and not plain IP
    - **Validates: Requirements 8.3**

  - [x] 2.3 Create rate limiter utility
    - Implement in-memory rate limiter with configurable limits
    - Support different limits per action type (votes: 10/min, plays: 100/hr)
    - Return remaining attempts and reset time
    - _Requirements: 8.1, 8.2_

  - [x] 2.4 Write property test for rate limiter
    - **Property 12: Rate Limiting Enforcement**
    - Test that actions are rejected after limit exceeded
    - **Validates: Requirements 8.1, 8.2**

  - [x] 2.5 Create hotness score calculator
    - Implement calculateHotnessScore function with weighted formula
    - Apply time decay based on content age
    - _Requirements: 5.1_

  - [x] 2.6 Write property test for hotness score
    - **Property 7: Hotness Score Calculation Consistency**
    - Test formula correctness and ordering
    - **Validates: Requirements 5.1**

- [x] 3. Checkpoint - Verify utilities
  - Ensure all utility tests pass
  - Ask the user if questions arise

- [x] 4. Database operations for engagement
  - [x] 4.1 Implement vote database operations
    - Add upsertVote function (create or update vote)
    - Add removeVote function
    - Add getVoteByIpAndMedia function
    - Add getVoteCounts function
    - Add updateMediaFileVoteCounts function
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 4.2 Write property tests for vote operations
    - **Property 1: Vote Recording and Count Update**
    - **Property 2: Vote Uniqueness Per IP/Media File**
    - **Property 3: Vote Modification Round-Trip**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

  - [x] 4.3 Implement event log database operations
    - Add createPlayLog function
    - Add createDownloadLog function
    - Add createViewLog function
    - Add incrementPlayCount, incrementDownloadCount, incrementViewCount functions
    - Add getPlayCountByPeriod function (24h, 7d, 30d, all)
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.1, 4.2_

  - [x] 4.4 Write property tests for event logs
    - **Property 4: Event Log Data Completeness**
    - **Property 6: Play Count Time-Period Filtering**
    - **Validates: Requirements 2.2, 2.4, 3.2, 4.2**

  - [x] 4.5 Implement activity feed database operations
    - Add createActivityFeedItem function
    - Add getRecentActivity function with limit
    - Add pruneOldActivity function (keep last 1000)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 4.6 Write property tests for activity feed
    - **Property 10: Activity Feed Item Creation**
    - **Property 11: Activity Feed Recency and Limit**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

  - [x] 4.7 Implement trending and popular queries
    - Add getTrendingMedia function (by engagement velocity)
    - Add getPopularMedia function (by play count with period filter)
    - Add getHotMedia function (by hotness score)
    - Add updateHotnessScores function (batch update)
    - _Requirements: 5.2, 5.3_

  - [x] 4.8 Write property tests for trending/popular
    - **Property 8: Trending List Ordering**
    - **Property 9: Popular List Ordering by Play Count**
    - **Validates: Requirements 5.2, 5.3**

- [x] 5. Checkpoint - Verify database operations
  - Ensure all database operation tests pass
  - Ask the user if questions arise

- [x] 6. tRPC engagement router
  - [x] 6.1 Create engagement router structure
    - Add engagement router to appRouter
    - Set up rate limiting middleware integration
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 6.2 Implement voting endpoints
    - Add vote mutation (with rate limiting)
    - Add removeVote mutation
    - Add getVoteStatus query
    - Add getVoteCounts query
    - _Requirements: 1.1, 1.2, 1.3, 8.1_

  - [x] 6.3 Implement analytics tracking endpoints
    - Add recordPlay mutation
    - Add recordDownload mutation
    - Add recordView mutation
    - Add getStats query for media file
    - _Requirements: 2.1, 3.1, 4.1_

  - [x] 6.4 Implement trending/popular endpoints
    - Add getTrending query
    - Add getPopular query with period parameter
    - Add getHot query
    - _Requirements: 5.2, 5.3_

  - [x] 6.5 Implement activity feed endpoint
    - Add getRecentActivity query
    - _Requirements: 6.5_

  - [x] 6.6 Write property test for API error handling
    - **Property 14: API Error Message Descriptiveness**
    - Test error responses for various failure cases
    - **Validates: Requirements 9.5**

- [x] 7. Server-Sent Events for real-time updates
  - [x] 7.1 Create SSE handler
    - Implement ActivityBroadcaster class
    - Add client connection management
    - Add broadcast method for activity events
    - _Requirements: 6.6_

  - [x] 7.2 Integrate SSE with Express
    - Add /api/activity-stream endpoint
    - Handle connection/disconnection
    - Set appropriate headers for SSE
    - _Requirements: 6.6_

  - [x] 7.3 Wire activity events to broadcaster
    - Broadcast on vote, play, download, upload, comment
    - Include media title and location in events
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 8. Checkpoint - Verify backend
  - Test all tRPC endpoints manually
  - Verify SSE connection works
  - Ensure all backend tests pass
  - Ask the user if questions arise

- [-] 9. Frontend components
  - [-] 9.1 Create VoteButtons component
    - Implement thumbs up/down buttons with counts
    - Add loading and disabled states
    - Add vote count animation on change
    - Wire to engagement.vote mutation
    - _Requirements: 1.1, 1.2, 1.5, 7.3_

  - [ ] 9.2 Create PopularityMetrics component
    - Display play count, download count, view count
    - Display upvotes and downvotes
    - Support compact mode for cards
    - _Requirements: 2.3, 3.3, 4.3_

  - [ ] 9.3 Create ActivityFeed component
    - Display recent activity items
    - Support collapsible/dismissible UI
    - Connect to SSE for real-time updates
    - Add loading state
    - _Requirements: 6.5, 7.1, 7.2, 7.4_

  - [ ] 9.4 Create TrendingList component
    - Display trending/popular media files
    - Support period selector (24h, 7d, 30d, all)
    - Show rank numbers
    - _Requirements: 5.2, 5.3_

- [ ] 10. Integrate components into existing pages
  - [ ] 10.1 Update MediaFileCard component
    - Add VoteButtons component
    - Add PopularityMetrics in compact mode
    - Track downloads via engagement.recordDownload
    - _Requirements: 1.1, 1.2, 2.3, 3.1, 3.3, 4.3_

  - [ ] 10.2 Update MediaDetail page
    - Add VoteButtons component
    - Add full PopularityMetrics display
    - Call engagement.recordView on page load
    - _Requirements: 1.1, 1.2, 4.1_

  - [ ] 10.3 Update MusicPlayerContext
    - Call engagement.recordPlay when playback completes or reaches threshold
    - Track play duration
    - _Requirements: 2.1_

  - [ ] 10.4 Add ActivityFeed to Dashboard
    - Add collapsible ActivityFeed panel at top
    - Persist collapsed state to localStorage
    - _Requirements: 6.5, 7.1, 7.2_

  - [ ] 10.5 Create Trending/Popular section on Dashboard
    - Add TrendingList component
    - Add tab navigation for trending/popular/hot
    - _Requirements: 5.2, 5.3_

- [ ] 11. Checkpoint - Verify frontend integration
  - Test voting flow end-to-end
  - Test activity feed real-time updates
  - Test trending/popular lists
  - Verify mobile responsiveness
  - Ask the user if questions arise

- [ ] 12. Final integration and polish
  - [ ] 12.1 Add engagement metrics to media list queries
    - Update media.list to include engagement counts
    - Update media.getById to include engagement counts
    - _Requirements: 2.3, 3.3, 4.3_

  - [ ] 12.2 Write property test for engagement metrics in response
    - **Property 5: Engagement Metrics in Media File Response**
    - **Validates: Requirements 2.3, 3.3, 4.3**

  - [ ] 12.3 Add activity feed items for existing actions
    - Add activity feed item on media upload
    - Add activity feed item on comment creation
    - _Requirements: 6.3, 6.4_

- [ ] 13. Final checkpoint
  - Run full test suite
  - Verify all engagement features work together
  - Ensure all tests pass
  - Ask the user if questions arise

## Notes

- All tasks including property tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Use fast-check library for property-based testing in TypeScript
