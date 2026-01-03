# Requirements Document

## Introduction

This document defines the requirements for adding comprehensive social media-style engagement features and real-time activity tracking to the music hosting platform. The goal is to make the platform feel alive and engaging by implementing voting systems, analytics tracking, trending content algorithms, and a live activity dashboard.

## Glossary

- **Media_File**: An audio or video file stored in the platform
- **Vote_System**: The thumbs up/down voting mechanism for media files
- **Play_Log**: A record of when a media file is played to completion
- **Activity_Feed**: A real-time stream of user actions on the platform
- **Hotness_Score**: A calculated metric combining recent plays, votes, comments, and downloads
- **Engagement_Velocity**: The rate of engagement change over a time period
- **IP_Hash**: A privacy-preserving hashed representation of a user's IP address
- **WebSocket_Connection**: A persistent bidirectional connection for real-time updates
- **Rate_Limiter**: A mechanism to prevent spam by limiting action frequency

## Requirements

### Requirement 1: Voting System

**User Story:** As a listener, I want to vote thumbs up or thumbs down on media files, so that I can express my opinion and help surface quality content.

#### Acceptance Criteria

1. WHEN a user clicks the thumbs up button on a media file, THE Vote_System SHALL record an upvote and increment the displayed upvote count
2. WHEN a user clicks the thumbs down button on a media file, THE Vote_System SHALL record a downvote and increment the displayed downvote count
3. WHEN a user has already voted on a media file, THE Vote_System SHALL allow them to change their vote or remove it
4. THE Vote_System SHALL track votes by IP_Hash and session to prevent duplicate voting from the same source
5. WHEN displaying vote counts, THE Vote_System SHALL show both thumbs up and thumbs down totals separately
6. THE Vote_System SHALL persist vote data to the database with IP_Hash and timestamp

### Requirement 2: Play Count Tracking

**User Story:** As a platform administrator, I want to track how many times each media file is played, so that I can understand content popularity.

#### Acceptance Criteria

1. WHEN a media file playback completes or reaches a significant portion (e.g., 30 seconds or 50%), THE Play_Log SHALL increment the play count
2. THE Play_Log SHALL record the IP_Hash, timestamp, and media file ID for each play event
3. WHEN displaying media file information, THE Media_File_Card SHALL show the total play count
4. THE Play_Log SHALL support querying play counts by time period (24h, 7d, 30d, all-time)

### Requirement 3: Download Count Tracking

**User Story:** As a content creator, I want to see how many times my files have been downloaded, so that I can measure content distribution.

#### Acceptance Criteria

1. WHEN a user clicks the download button for a media file, THE Download_Log SHALL increment the download count
2. THE Download_Log SHALL record the IP_Hash, timestamp, and media file ID for each download
3. WHEN displaying media file information, THE Media_File_Card SHALL show the total download count

### Requirement 4: View Count Tracking

**User Story:** As a platform administrator, I want to track page views for media files, so that I can understand content discovery patterns.

#### Acceptance Criteria

1. WHEN a user visits the MediaDetail page for a file, THE View_Log SHALL increment the view count
2. THE View_Log SHALL record the IP_Hash, timestamp, and media file ID for each view
3. WHEN displaying media file information, THE Media_File_Card SHALL show the total view count

### Requirement 5: Trending and Popular Content

**User Story:** As a listener, I want to discover trending and popular content, so that I can find engaging music that others enjoy.

#### Acceptance Criteria

1. THE Hotness_Score SHALL be calculated using a weighted combination of recent plays, votes, comments, and downloads
2. WHEN displaying trending content, THE Trending_List SHALL show files with the highest Engagement_Velocity in the last 24 hours
3. WHEN displaying most listened content, THE Popular_List SHALL rank files by total play count for selectable time periods (24h, 7d, 30d, all-time)
4. THE Trending_List SHALL update periodically to reflect current engagement patterns

### Requirement 6: Real-time Activity Feed

**User Story:** As a platform user, I want to see live activity on the platform, so that I can feel connected to the community and discover new content.

#### Acceptance Criteria

1. WHEN a user plays a media file, THE Activity_Feed SHALL display "User from [Location] is listening to [Song Name]" in real-time
2. WHEN a user downloads a media file, THE Activity_Feed SHALL display the download action
3. WHEN a user uploads a new media file, THE Activity_Feed SHALL display the upload with timestamp
4. WHEN a user comments on a media file, THE Activity_Feed SHALL display the comment action
5. THE Activity_Feed SHALL show the last 10-20 recent actions
6. THE Activity_Feed SHALL use WebSocket_Connection or Server-Sent Events for real-time updates

### Requirement 7: Activity Feed UI

**User Story:** As a user, I want to control the visibility of the activity feed, so that I can focus on content when needed.

#### Acceptance Criteria

1. THE Activity_Feed SHALL be displayed as a prominent dialog or panel at the top of dashboard pages
2. THE Activity_Feed SHALL be collapsible and dismissible by the user
3. WHEN vote counts change, THE Vote_System SHALL animate the count update
4. THE Activity_Feed SHALL display loading states while fetching data
5. THE Activity_Feed SHALL be responsive and work on mobile devices

### Requirement 8: Rate Limiting and Privacy

**User Story:** As a platform administrator, I want to prevent spam and protect user privacy, so that the platform remains trustworthy and secure.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL prevent more than 10 votes per minute from the same IP_Hash
2. THE Rate_Limiter SHALL prevent more than 100 play logs per hour from the same IP_Hash
3. THE Vote_System SHALL store IP addresses as hashed values (IP_Hash) to protect privacy
4. IF a rate limit is exceeded, THEN THE system SHALL return an appropriate error message without blocking legitimate usage

### Requirement 9: API Endpoints

**User Story:** As a developer, I want tRPC endpoints for all engagement features, so that the frontend can interact with the backend efficiently.

#### Acceptance Criteria

1. THE API SHALL provide endpoints for recording and retrieving votes
2. THE API SHALL provide endpoints for recording play, download, and view events
3. THE API SHALL provide endpoints for retrieving trending and popular content lists
4. THE API SHALL provide endpoints for subscribing to the real-time activity feed
5. WHEN an API request fails, THE API SHALL return descriptive error messages
