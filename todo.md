# Music Hosting Platform TODO

## Recently Completed (February 2026)

### Video Player Overlay with Social Engagement
- [x] Dashboard video playback fix (actual content instead of decorative b-roll)
- [x] VideoPlayerOverlay component with minimize/maximize and close controls
- [x] MusicPlayerContext extended with video element registration (`registerVideoElement`, `unregisterVideoElement`)
- [x] Dual audio/video playback routing via `isVideoTrack` state
- [x] View count tracking fires when video starts playing (once per track per session)
- [x] Vote buttons (thumbs up/down) integrated into video player overlay
- [x] Threaded comments section with reply support in video overlay
- [x] Popularity metrics display (plays, downloads, views, votes) in compact mode
- [x] Engagement panel toggle button (💬) — shows/hides engagement UI in maximized mode, hidden in minimized mode
- [x] Dark theme engagement UI with translucent backgrounds and light text

### Chunked Video Uploads
- [x] Chunked upload implementation for files over 95MB (20MB chunks)
- [x] `Content-Range` and `X-Unique-Upload-Id` header support for Cloudinary chunked API
- [x] Client-side max video size increased to 300MB (requires Cloudinary Plus plan)
- [x] Upload timeout extended to 15 minutes for large files
- [x] Progress tracking across all upload chunks
- [x] Upload signature fix (`overwrite` parameter type mismatch between server and client)

### Public Share Page Engagement
- [x] VoteButtons integrated into public share page (anonymous voting via IP)
- [x] PopularityMetrics (compact) showing plays, downloads, views, votes on shared links
- [x] Threaded comments section on public share page (read-only for anonymous, input for logged-in users)
- [x] Login prompt for anonymous visitors in place of comment input
- [x] View tracking fires on shared page load via `engagement.recordView`
- [x] Download tracking via `engagement.recordDownload` when download button is clicked
- [x] Reply button only shown to logged-in users on public share page

## Recently Completed (January 2026)

### Social Engagement Features
- [x] Voting system (thumbs up/down) with IP-based uniqueness
- [x] Play count tracking (on playback completion or 30-second threshold)
- [x] Download count tracking with detailed logging
- [x] View count tracking for media detail pages
- [x] Trending content algorithm (engagement velocity in last 24h)
- [x] Popular content lists with time period filters (24h, 7d, 30d, all-time)
- [x] Hot content ranking (weighted engagement with time decay)
- [x] Real-time activity feed with Server-Sent Events
- [x] Rate limiting (10 votes/min, 100 plays/hr per IP)
- [x] IP hashing for privacy (SHA-256)
- [x] VoteButtons component with animated count updates
- [x] PopularityMetrics component (compact and full modes)
- [x] ActivityFeed component with SSE real-time updates
- [x] TrendingList component with period selector
- [x] Database schema extensions (votes, playLogs, downloadLogs, viewLogs, activityFeed tables)
- [x] Engagement columns on mediaFiles (playCount, downloadCount, viewCount, upvotes, downvotes, hotnessScore)
- [x] 65 property-based tests for engagement features (all passing)

## Recently Completed (December 2025)

### Infrastructure & Deployment
- [x] Vercel deployment configuration (`vercel.json`)
- [x] Serverless API handler (`api/index.ts`)
- [x] TypeScript configuration for API directory
- [x] Console error fixes (removed unused analytics, simplified login URL)

### Authentication & Access Control
- [x] Static admin authentication (username: admin, password: glunet)
- [x] JWT-based session management
- [x] User profile management for authenticated users

### Dashboard Structure
- [x] Hierarchical sections (Family, Work, Testing, etc.)
- [x] Add/modify/delete sections functionality
- [x] Nested categories/playlists within sections
- [x] Add/modify/delete categories functionality
- [x] Drag-and-drop interface for organization

### File Management
- [x] Upload songs/videos with Cloudinary storage integration
- [x] Download files functionality
- [x] Delete files functionality
- [x] Rename files functionality
- [x] Metadata fields: title, lyrics, music style
- [x] Album art/cover photo upload
- [x] Auto-naming generation for uniqueness

### Public Sharing
- [x] Public sharing links without login requirement
- [x] Public player view for shared content
- [x] Streaming playback support
- [x] Direct download option
- [x] Configurable sharing options per file

### Playback Features
- [x] Random music playback/shuffle functionality
- [x] Shuffle button at section level
- [x] Shuffle button at category level
- [x] Audio player integration
- [x] Video player integration
- [x] Category-level playlist functionality with sequential playback
- [x] Shuffle mode with intelligent track reordering
- [x] Loop mode for continuous playlist playback
- [x] Skip controls (previous/next track) in music player
- [x] Queue position indicator in player bar
- [x] Auto-advance to next track when current track ends
- [x] Persistent music player across page navigation

### Social Features
- [x] 5-star rating system for songs
- [x] Display average ratings
- [x] Threaded comment system
- [x] Comment moderation tied to user profiles
- [x] Collaborative tagging system
- [x] View/add/edit/create tags functionality
- [x] Tag cloud visualization for discovery

### Distribution Workflow
- [x] Metadata builder tool
- [x] Artist name and bio fields
- [x] ISRC/UPC generation support
- [x] Writer credits management
- [x] AI-assisted flag option
- [x] Lyrics field for distribution
- [x] Genres and moods selection
- [x] Cover art for distribution
- [x] Rights compliance checklist modal
- [x] AI policy documentation
- [x] Voice impersonation rules
- [x] Human contribution requirements (2025 U.S. Copyright Office)
- [x] Distribution platform integrations placeholder

### External Integration
- [x] RESTful API endpoint for third-party tools
- [x] API key authentication system
- [x] Playlist/section selection for imports
- [x] File/metadata export endpoint
- [x] API documentation

### Testing
- [x] Vitest tests for authentication
- [x] Vitest tests for file management
- [x] Vitest tests for social features
- [x] Vitest tests for API endpoints
- [x] Vitest tests for distribution workflow
- [x] Property-based tests for social engagement (65 tests)
  - [x] Vote recording and count updates (Property 1)
  - [x] Vote uniqueness per IP/media file (Property 2)
  - [x] Vote modification round-trip (Property 3)
  - [x] Event log data completeness (Property 4)
  - [x] Engagement metrics in responses (Property 5)
  - [x] Play count time-period filtering (Property 6)
  - [x] Hotness score calculation (Property 7)
  - [x] Trending list ordering (Property 8)
  - [x] Popular list ordering (Property 9)
  - [x] Activity feed creation (Property 10)
  - [x] Activity feed recency/limit (Property 11)
  - [x] Rate limiting enforcement (Property 12)
  - [x] IP hashing for privacy (Property 13)
  - [x] API error descriptiveness (Property 14)

---

## Remaining Tasks

### High Priority - Bugs & Issues
- [ ] Verify Vercel deployment works end-to-end after configuration changes
- [ ] Test all API endpoints in production environment
- [ ] Ensure environment variables are properly configured in Vercel dashboard
- [ ] Fix pre-existing test failures in `auth.test.ts` (credential configuration)
- [ ] Fix pre-existing test failures in `sections.test.ts` (database availability in tests)

### Medium Priority - Infrastructure
- [ ] Set up error monitoring (Sentry or similar)
- [ ] Configure proper logging for serverless functions
- [x] Add rate limiting to API endpoints (implemented for engagement features)
- [ ] Implement CORS configuration for API security
- [ ] Add scheduled job for hotness score recalculation (currently on-demand)
- [ ] Add activity feed pruning job (keep last 1000 items)

---

## Future Enhancements

### Bulk Upload & Import
- [ ] Bulk file upload functionality (multiple files at once)
- [ ] CSV metadata mapping for batch imports
- [ ] Drag-and-drop multiple files interface
- [ ] Progress tracking for bulk uploads
- [ ] Error handling and retry for failed uploads
- [ ] Preview and validation before final import

### Playlist Management (Enhanced)
- [x] Category-level playlist with sequential playback
- [x] Shuffle mode with intelligent track reordering
- [x] Loop mode for continuous playback
- [x] Skip previous/next controls
- [x] Auto-advance to next track
- [ ] Cross-category playlists (create custom playlists spanning multiple categories)
- [ ] Playlist persistence across browser sessions (localStorage/database)
- [ ] Keyboard shortcuts for playlist controls (space, arrow keys, etc.)
- [ ] Visual queue/playlist viewer component (see upcoming tracks)
- [ ] Add/remove individual tracks from active queue
- [ ] Reorder playlist tracks with drag-and-drop
- [ ] Share playlists publicly with shareable links
- [ ] Collaborative playlists (multiple users can contribute)
- [ ] Smart playlists based on tags, ratings, or genres
- [ ] "Add to queue" option on individual track cards
- [ ] Shuffle remaining tracks only (preserve played history)

### Analytics Dashboard
- [x] Track play counts per media file
- [x] View most popular tracks by plays
- [x] User engagement metrics (votes, plays, downloads, views)
- [x] Real-time activity feed with live updates
- [ ] Time-based analytics charts (daily, weekly, monthly trends)
- [ ] Geographic distribution of listeners (if available)
- [ ] Export analytics reports to CSV/PDF
- [ ] Analytics dashboard page with visualizations

### Additional Features
- [ ] Search functionality across all media files
- [ ] Advanced filtering (by genre, mood, rating, date)
- [ ] Favorites/bookmarks system for users
- [ ] Download history tracking
- [ ] Email notifications for new comments/ratings
- [ ] Mobile-responsive design improvements
- [ ] Dark mode theme option
- [ ] Keyboard shortcuts for power users
- [ ] Batch operations (delete, move, tag multiple files)
- [ ] Integration with music distribution platforms (DistroKid, TuneCore)
- [ ] Automatic metadata extraction from audio files
- [ ] Waveform visualization for audio tracks
- [ ] Collaborative editing of metadata
- [ ] Version history for tracks (upload new versions)
- [ ] Scheduled publishing for future releases

### Social Engagement Enhancements
- [ ] User accounts for persistent voting (currently IP-based)
- [ ] Comment voting (upvote/downvote comments)
- [ ] Notification system for engagement on your content
- [ ] Weekly/monthly trending charts
- [ ] Engagement leaderboards
- [ ] Social sharing buttons (Twitter, Facebook, etc.)
- [ ] Embed player widget for external sites
- [ ] Activity feed filtering by type
- [ ] Personalized recommendations based on engagement history
- [ ] Geographic location display in activity feed (from IP geolocation)

### Video Player Overlay Enhancements
- [ ] Keyboard shortcut to toggle engagement panel (e.g., `E` key)
- [ ] Persistent engagement panel state across tracks (localStorage)
- [ ] Mobile-responsive video overlay layout (touch-friendly controls)
- [ ] Swipe gestures for minimized video player (swipe up to maximize, swipe down to dismiss)
- [ ] Picture-in-picture (PiP) mode support for video playback
- [ ] Comment sorting options (newest, oldest, most replies)
- [ ] Real-time comment updates via Server-Sent Events
- [ ] Video quality selector (if Cloudinary adaptive streaming is enabled)
- [ ] Playback speed controls (0.5x, 1x, 1.25x, 1.5x, 2x)
- [ ] Video timestamp comments (link comments to specific moments in the video)
- [ ] Engagement panel animations/transitions (slide in/out)
- [ ] Share button in video overlay to generate public share link

---

## Suggested Next Steps

### Immediate (Before Production)

1. **Verify Vercel Deployment**
   - Confirm environment variables are set in Vercel dashboard
   - Test the deployed application end-to-end
   - Check API routes are working correctly

2. **Security Hardening**
   - Implement rate limiting on API endpoints
   - Add CORS configuration
   - Review authentication token expiration

3. **Monitoring Setup**
   - Add error tracking (e.g., Sentry)
   - Configure logging for debugging
   - Set up uptime monitoring

### Short-term (1-2 Weeks)

1. **Playlist Enhancements**
   - Add keyboard shortcuts for playlist controls (space, arrows, etc.)
   - Persist playlist/queue state to localStorage for session recovery
   - Add visual queue viewer to see upcoming tracks
   - Add "Add to queue" option on individual media file cards

2. **Performance Optimization**
   - Code-split large bundles (currently ~1.1MB after playlist features)
   - Lazy load heavy components
   - Optimize Cloudinary image delivery

3. **User Experience**
   - Add loading states and skeletons
   - Improve error messages
   - Add keyboard navigation for player and playlist

4. **Testing**
   - Add tests for playlist functionality
   - Add integration tests for critical flows
   - Test serverless function cold starts

### Medium-term (1-2 Months)

1. **Feature Development**
   - Implement search functionality
   - Add bulk upload capability
   - Build analytics dashboard
   - Cross-category custom playlists

2. **Mobile Experience**
   - Responsive design audit
   - Touch-friendly controls for playlist
   - Progressive Web App (PWA) setup

3. **API Expansion**
   - Webhook support for integrations
   - OAuth for third-party apps
   - GraphQL endpoint option
