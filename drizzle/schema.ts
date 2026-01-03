import { integer, pgEnum, pgTable, text, timestamp, varchar, boolean, index, uniqueIndex, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// PostgreSQL enums
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const mediaTypeEnum = pgEnum("media_type", ["audio", "video"]);
export const voteTypeEnum = pgEnum("vote_type", ["up", "down"]);
export const activityTypeEnum = pgEnum("activity_type", ["play", "download", "view", "upload", "comment", "vote"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * Static admin credentials for direct login (not OAuth)
 */
export const adminCredentials = pgTable("admin_credentials", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * API keys for third-party integrations
 */
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  keyHash: text("key_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  isActive: boolean("is_active").default(true).notNull(),
}, (table) => ({
  userIdIdx: index("api_keys_user_id_idx").on(table.userId),
}));

/**
 * Top-level sections (Family, Work, Testing, etc.)
 */
export const sections = pgTable("sections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("sections_user_id_idx").on(table.userId),
}));

/**
 * Categories/playlists within sections
 */
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  sectionIdIdx: index("categories_section_id_idx").on(table.sectionId),
}));

/**
 * Media files (songs/videos)
 */
export const mediaFiles = pgTable("media_files", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull(),
  userId: integer("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileKey: text("file_key").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  mediaType: mediaTypeEnum("media_type").notNull(),

  // Metadata fields
  lyrics: text("lyrics"),
  musicStyle: varchar("music_style", { length: 255 }),
  coverArtKey: text("cover_art_key"),
  coverArtUrl: text("cover_art_url"),

  // Distribution metadata
  artistName: varchar("artist_name", { length: 255 }),
  artistBio: text("artist_bio"),
  isrc: varchar("isrc", { length: 20 }),
  upc: varchar("upc", { length: 20 }),
  writerCredits: text("writer_credits"),
  isAiAssisted: boolean("is_ai_assisted").default(false),
  genres: text("genres"),
  moods: text("moods"),

  // Sharing settings
  shareToken: varchar("share_token", { length: 64 }).unique(),
  isPubliclyShared: boolean("is_publicly_shared").default(false),
  allowDownload: boolean("allow_download").default(true),
  allowStreaming: boolean("allow_streaming").default(true),

  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),

  // Engagement tracking columns
  playCount: integer("play_count").default(0).notNull(),
  downloadCount: integer("download_count").default(0).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  upvotes: integer("upvotes").default(0).notNull(),
  downvotes: integer("downvotes").default(0).notNull(),
  hotnessScore: integer("hotness_score").default(0).notNull(),
  lastHotnessUpdate: timestamp("last_hotness_update"),
}, (table) => ({
  categoryIdIdx: index("media_files_category_id_idx").on(table.categoryId),
  userIdIdx: index("media_files_user_id_idx").on(table.userId),
  shareTokenIdx: uniqueIndex("media_files_share_token_idx").on(table.shareToken),
}));

/**
 * Tags for collaborative tagging system
 */
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Junction table for media files and tags
 */
export const mediaFileTags = pgTable("media_file_tags", {
  id: serial("id").primaryKey(),
  mediaFileId: integer("media_file_id").notNull(),
  tagId: integer("tag_id").notNull(),
  addedById: integer("added_by_id").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  mediaFileIdIdx: index("media_file_tags_media_file_id_idx").on(table.mediaFileId),
  tagIdIdx: index("media_file_tags_tag_id_idx").on(table.tagId),
  uniqueMediaTag: uniqueIndex("media_file_tags_unique_media_tag").on(table.mediaFileId, table.tagId),
}));

/**
 * Ratings for media files
 */
export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  mediaFileId: integer("media_file_id").notNull(),
  userId: integer("user_id").notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  mediaFileIdIdx: index("ratings_media_file_id_idx").on(table.mediaFileId),
  userIdIdx: index("ratings_user_id_idx").on(table.userId),
  uniqueUserMedia: uniqueIndex("ratings_unique_user_media").on(table.userId, table.mediaFileId),
}));

/**
 * Comments on media files
 */
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  mediaFileId: integer("media_file_id").notNull(),
  userId: integer("user_id").notNull(),
  parentCommentId: integer("parent_comment_id"), // For threaded replies
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  mediaFileIdIdx: index("comments_media_file_id_idx").on(table.mediaFileId),
  userIdIdx: index("comments_user_id_idx").on(table.userId),
  parentCommentIdIdx: index("comments_parent_comment_id_idx").on(table.parentCommentId),
}));

/**
 * Votes table - tracks thumbs up/down per media file
 * Uses IP hash for anonymous voting while preventing duplicates
 */
export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  mediaFileId: integer("media_file_id").notNull(),
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  sessionId: varchar("session_id", { length: 64 }),
  voteType: voteTypeEnum("vote_type").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  mediaFileIdIdx: index("votes_media_file_id_idx").on(table.mediaFileId),
  ipHashIdx: index("votes_ip_hash_idx").on(table.ipHash),
  uniqueVote: uniqueIndex("votes_unique_vote").on(table.mediaFileId, table.ipHash),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sections: many(sections),
  mediaFiles: many(mediaFiles),
  ratings: many(ratings),
  comments: many(comments),
  apiKeys: many(apiKeys),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  user: one(users, {
    fields: [sections.userId],
    references: [users.id],
  }),
  categories: many(categories),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  section: one(sections, {
    fields: [categories.sectionId],
    references: [sections.id],
  }),
  mediaFiles: many(mediaFiles),
}));

export const mediaFilesRelations = relations(mediaFiles, ({ one, many }) => ({
  category: one(categories, {
    fields: [mediaFiles.categoryId],
    references: [categories.id],
  }),
  user: one(users, {
    fields: [mediaFiles.userId],
    references: [users.id],
  }),
  tags: many(mediaFileTags),
  ratings: many(ratings),
  comments: many(comments),
  votes: many(votes),
  playLogs: many(playLogs),
  downloadLogs: many(downloadLogs),
  viewLogs: many(viewLogs),
  activityFeedItems: many(activityFeed),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [tags.createdById],
    references: [users.id],
  }),
  mediaFiles: many(mediaFileTags),
}));

export const mediaFileTagsRelations = relations(mediaFileTags, ({ one }) => ({
  mediaFile: one(mediaFiles, {
    fields: [mediaFileTags.mediaFileId],
    references: [mediaFiles.id],
  }),
  tag: one(tags, {
    fields: [mediaFileTags.tagId],
    references: [tags.id],
  }),
  addedBy: one(users, {
    fields: [mediaFileTags.addedById],
    references: [users.id],
  }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  mediaFile: one(mediaFiles, {
    fields: [ratings.mediaFileId],
    references: [mediaFiles.id],
  }),
  user: one(users, {
    fields: [ratings.userId],
    references: [users.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  mediaFile: one(mediaFiles, {
    fields: [comments.mediaFileId],
    references: [mediaFiles.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  parentComment: one(comments, {
    fields: [comments.parentCommentId],
    references: [comments.id],
  }),
  replies: many(comments),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  mediaFile: one(mediaFiles, {
    fields: [votes.mediaFileId],
    references: [mediaFiles.id],
  }),
}));

/**
 * Play logs - detailed play event tracking
 * Records each play event with duration and timestamp for analytics
 */
export const playLogs = pgTable("play_logs", {
  id: serial("id").primaryKey(),
  mediaFileId: integer("media_file_id").notNull(),
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  sessionId: varchar("session_id", { length: 64 }),
  playDuration: integer("play_duration"), // seconds played
  completedAt: timestamp("completedAt").defaultNow().notNull(),
}, (table) => ({
  mediaFileIdIdx: index("play_logs_media_file_id_idx").on(table.mediaFileId),
  completedAtIdx: index("play_logs_completed_at_idx").on(table.completedAt),
}));

/**
 * Download logs - tracks file download events
 * Records each download with IP hash and timestamp
 */
export const downloadLogs = pgTable("download_logs", {
  id: serial("id").primaryKey(),
  mediaFileId: integer("media_file_id").notNull(),
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  downloadedAt: timestamp("downloadedAt").defaultNow().notNull(),
}, (table) => ({
  mediaFileIdIdx: index("download_logs_media_file_id_idx").on(table.mediaFileId),
  downloadedAtIdx: index("download_logs_downloaded_at_idx").on(table.downloadedAt),
}));

/**
 * View logs - tracks page view events for media files
 * Records each view with IP hash and timestamp
 */
export const viewLogs = pgTable("view_logs", {
  id: serial("id").primaryKey(),
  mediaFileId: integer("media_file_id").notNull(),
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
}, (table) => ({
  mediaFileIdIdx: index("view_logs_media_file_id_idx").on(table.mediaFileId),
  viewedAtIdx: index("view_logs_viewed_at_idx").on(table.viewedAt),
}));

/**
 * Activity feed - stores recent platform activity for real-time updates
 * Records user actions like plays, downloads, uploads, comments, and votes
 */
export const activityFeed = pgTable("activity_feed", {
  id: serial("id").primaryKey(),
  activityType: activityTypeEnum("activity_type").notNull(),
  mediaFileId: integer("media_file_id"),
  mediaTitle: varchar("media_title", { length: 255 }),
  ipHash: varchar("ip_hash", { length: 64 }),
  location: varchar("location", { length: 100 }), // City/Country from IP
  metadata: text("metadata"), // JSON for additional data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index("activity_feed_created_at_idx").on(table.createdAt),
  activityTypeIdx: index("activity_feed_activity_type_idx").on(table.activityType),
}));

// Play logs relations
export const playLogsRelations = relations(playLogs, ({ one }) => ({
  mediaFile: one(mediaFiles, {
    fields: [playLogs.mediaFileId],
    references: [mediaFiles.id],
  }),
}));

// Download logs relations
export const downloadLogsRelations = relations(downloadLogs, ({ one }) => ({
  mediaFile: one(mediaFiles, {
    fields: [downloadLogs.mediaFileId],
    references: [mediaFiles.id],
  }),
}));

// View logs relations
export const viewLogsRelations = relations(viewLogs, ({ one }) => ({
  mediaFile: one(mediaFiles, {
    fields: [viewLogs.mediaFileId],
    references: [mediaFiles.id],
  }),
}));

// Activity feed relations
export const activityFeedRelations = relations(activityFeed, ({ one }) => ({
  mediaFile: one(mediaFiles, {
    fields: [activityFeed.mediaFileId],
    references: [mediaFiles.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AdminCredential = typeof adminCredentials.$inferSelect;
export type InsertAdminCredential = typeof adminCredentials.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
export type Section = typeof sections.$inferSelect;
export type InsertSection = typeof sections.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export type MediaFile = typeof mediaFiles.$inferSelect;
export type InsertMediaFile = typeof mediaFiles.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;
export type MediaFileTag = typeof mediaFileTags.$inferSelect;
export type InsertMediaFileTag = typeof mediaFileTags.$inferInsert;
export type Rating = typeof ratings.$inferSelect;
export type InsertRating = typeof ratings.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof votes.$inferInsert;
export type PlayLog = typeof playLogs.$inferSelect;
export type InsertPlayLog = typeof playLogs.$inferInsert;
export type DownloadLog = typeof downloadLogs.$inferSelect;
export type InsertDownloadLog = typeof downloadLogs.$inferInsert;
export type ViewLog = typeof viewLogs.$inferSelect;
export type InsertViewLog = typeof viewLogs.$inferInsert;
export type ActivityFeedItem = typeof activityFeed.$inferSelect;
export type InsertActivityFeedItem = typeof activityFeed.$inferInsert;
