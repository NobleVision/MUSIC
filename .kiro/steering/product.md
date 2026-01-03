# Product Overview

## Music Hosting & Distribution Platform

A comprehensive media management and distribution platform designed for organizing, sharing, and distributing music and video content.

### Core Features

- **Hierarchical Organization**: Content organized in sections → categories → media files
- **Static Admin Authentication**: Simple login with hardcoded credentials (admin/glunet)
- **Media Management**: Upload, organize, and manage audio/video files with metadata
- **Public Sharing**: Generate shareable links for individual tracks/videos
- **Social Features**: 5-star ratings, threaded comments, collaborative tagging
- **Distribution Tools**: Metadata builder with ISRC/UPC codes, artist info, genre/mood tagging
- **External API**: RESTful endpoints for third-party integrations

### Target Users

- Music creators and distributors
- Content managers organizing media libraries
- Teams needing collaborative media organization
- Third-party tools requiring media import/export capabilities

### Key Business Logic

- All content belongs to authenticated users
- Hierarchical permissions: users own sections, which contain categories, which contain media files
- Public sharing via unique tokens (no auth required for shared content)
- API key authentication for external integrations
- Compliance features for 2025 U.S. Copyright Office guidelines