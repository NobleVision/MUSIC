# Music Hosting Platform TODO

## Authentication & Access Control
- [x] Static admin authentication (username: admin, password: glunet)
- [x] JWT-based session management
- [x] User profile management for authenticated users

## Dashboard Structure
- [x] Hierarchical sections (Family, Work, Testing, etc.)
- [x] Add/modify/delete sections functionality
- [x] Nested categories/playlists within sections
- [x] Add/modify/delete categories functionality
- [x] Drag-and-drop interface for organization

## File Management
- [x] Upload songs/videos with S3 storage integration
- [x] Download files functionality
- [x] Delete files functionality
- [x] Rename files functionality
- [x] Metadata fields: title, lyrics, music style
- [x] Album art/cover photo upload
- [x] Auto-naming generation for uniqueness

## Public Sharing
- [x] Public sharing links without login requirement
- [x] Public player view for shared content
- [x] Streaming playback support
- [x] Direct download option
- [x] Configurable sharing options per file

## Playback Features
- [x] Random music playback/shuffle functionality
- [x] Shuffle button at section level
- [x] Shuffle button at category level
- [x] Audio player integration
- [x] Video player integration

## Social Features
- [x] 5-star rating system for songs
- [x] Display average ratings
- [x] Threaded comment system
- [x] Comment moderation tied to user profiles
- [x] Collaborative tagging system
- [x] View/add/edit/create tags functionality
- [x] Tag cloud visualization for discovery

## Distribution Workflow
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

## External Integration
- [x] RESTful API endpoint for third-party tools
- [x] API key authentication system
- [x] Playlist/section selection for imports
- [x] File/metadata export endpoint
- [x] API documentation

## Testing
- [x] Vitest tests for authentication
- [x] Vitest tests for file management
- [x] Vitest tests for social features
- [x] Vitest tests for API endpoints
- [x] Vitest tests for distribution workflow

## Future Enhancements

### Bulk Upload & Import
- [ ] Bulk file upload functionality (multiple files at once)
- [ ] CSV metadata mapping for batch imports
- [ ] Drag-and-drop multiple files interface
- [ ] Progress tracking for bulk uploads
- [ ] Error handling and retry for failed uploads
- [ ] Preview and validation before final import

### Playlist Management
- [ ] Create custom playlists spanning multiple categories
- [ ] Add/remove tracks from playlists
- [ ] Reorder playlist tracks with drag-and-drop
- [ ] Share playlists publicly
- [ ] Collaborative playlists (multiple users can contribute)
- [ ] Smart playlists based on tags, ratings, or genres

### Analytics Dashboard
- [ ] Track play counts per media file
- [ ] View most popular tracks by plays
- [ ] User engagement metrics (comments, ratings, shares)
- [ ] Time-based analytics (daily, weekly, monthly trends)
- [ ] Geographic distribution of listeners (if available)
- [ ] Export analytics reports to CSV/PDF
- [ ] Real-time analytics dashboard with charts

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
