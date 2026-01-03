import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { hashPassword, verifyPassword, generateToken, generateApiKey, hashApiKey } from "./auth";
import { storagePut, generateUploadSignature } from "./storage";
import {
  getClientIpHash,
  rateLimiter,
  upsertVote,
  removeVote,
  getVoteByIpAndMedia,
  getVoteCounts,
  createPlayLog,
  createDownloadLog,
  createViewLog,
  incrementPlayCount,
  incrementDownloadCount,
  incrementViewCount,
  createActivityFeedItem,
  getRecentActivity,
  getTrendingMedia,
  getPopularMedia,
  getHotMedia,
  type VoteType,
  type TimePeriod,
} from "./engagement";
import { broadcastActivity } from "./sse";

// Admin credentials (set these in Vercel Project Settings > Environment Variables)
// Defaults are for convenience only; change them in production.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin";

// Special openId prefix for admin users (not from OAuth)
const ADMIN_OPENID_PREFIX = "admin::";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    
    // Static admin login
    adminLogin: publicProcedure
      .input(z.object({
        username: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { username, password } = input;

        // First, check env-based credentials (works without database)
        let isValidCredentials = false;
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
          isValidCredentials = true;
        } else {
          // Check database credentials as fallback
          let adminCred = await db.getAdminCredentialByUsername(username);
          if (!adminCred && username === ADMIN_USERNAME) {
            // Initialize default admin on first login attempt
            try {
              const passwordHash = hashPassword(ADMIN_PASSWORD);
              await db.createAdminCredential(ADMIN_USERNAME, passwordHash);
              adminCred = await db.getAdminCredentialByUsername(username);
            } catch (e) {
              // Database not available, and hardcoded creds didn't match
            }
          }

          if (adminCred && verifyPassword(password, adminCred.passwordHash)) {
            isValidCredentials = true;
          }
        }

        if (!isValidCredentials) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid username or password",
          });
        }

        // Create admin openId (unique per username)
        const adminOpenId = `${ADMIN_OPENID_PREFIX}${username}`;

        // Ensure admin user exists in database with admin role
        try {
          await db.upsertUser({
            openId: adminOpenId,
            name: username,
            role: "admin",
            lastSignedIn: new Date(),
          });
        } catch (e) {
          // Database might not be available, but we can still create session
          console.warn("[Auth] Could not upsert admin user to database:", e);
        }

        // Create a session token using the SDK (uses correct JWT format with openId, appId, name)
        const token = await sdk.createSessionToken(adminOpenId, {
          name: username,
          expiresInMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return { success: true, isAdmin: true };
      }),
  }),

  // Upload signature for direct Cloudinary uploads (bypasses Vercel 4.5MB limit)
  upload: router({
    getSignature: protectedProcedure
      .input(z.object({
        filename: z.string(),
        contentType: z.string(),
        folder: z.string().optional(),
      }))
      .mutation(({ input }) => {
        // Generate a unique key for this upload
        const folder = input.folder || 'media';
        const key = `${folder}/${Date.now()}-${input.filename}`;

        const signature = generateUploadSignature(key, input.contentType);

        return {
          ...signature,
          key,
        };
      }),
  }),

  // Sections management
  sections: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserSections(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        displayOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createSection({
          userId: ctx.user.id,
          name: input.name,
          description: input.description || null,
          displayOrder: input.displayOrder || 0,
        });
        return { success: true };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        displayOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const section = await db.getSectionById(input.id);
        if (!section || section.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        const updateData: any = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;
        
        await db.updateSection(input.id, updateData);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const section = await db.getSectionById(input.id);
        if (!section || section.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        await db.deleteSection(input.id);
        return { success: true };
      }),
    
    reorder: protectedProcedure
      .input(z.object({
        sectionIds: z.array(z.number()),
      }))
      .mutation(async ({ input, ctx }) => {
        // Update display order for all sections
        for (let i = 0; i < input.sectionIds.length; i++) {
          const section = await db.getSectionById(input.sectionIds[i]!);
          if (section && section.userId === ctx.user.id) {
            await db.updateSection(input.sectionIds[i]!, { displayOrder: i });
          }
        }
        return { success: true };
      }),
  }),
  
  // Categories management
  categories: router({
    list: protectedProcedure
      .input(z.object({ sectionId: z.number() }))
      .query(async ({ input, ctx }) => {
        const section = await db.getSectionById(input.sectionId);
        if (!section || section.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return await db.getSectionCategories(input.sectionId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        sectionId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        displayOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const section = await db.getSectionById(input.sectionId);
        if (!section || section.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        await db.createCategory({
          sectionId: input.sectionId,
          name: input.name,
          description: input.description || null,
          displayOrder: input.displayOrder || 0,
        });
        return { success: true };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        displayOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const category = await db.getCategoryById(input.id);
        if (!category) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        const section = await db.getSectionById(category.sectionId);
        if (!section || section.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        const updateData: any = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;
        
        await db.updateCategory(input.id, updateData);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const category = await db.getCategoryById(input.id);
        if (!category) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        const section = await db.getSectionById(category.sectionId);
        if (!section || section.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        await db.deleteCategory(input.id);
        return { success: true };
      }),
    
    reorder: protectedProcedure
      .input(z.object({
        sectionId: z.number(),
        categoryIds: z.array(z.number()),
      }))
      .mutation(async ({ input, ctx }) => {
        const section = await db.getSectionById(input.sectionId);
        if (!section || section.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        for (let i = 0; i < input.categoryIds.length; i++) {
          await db.updateCategory(input.categoryIds[i]!, { displayOrder: i });
        }
        return { success: true };
      }),
  }),
  
  // Media files management
  media: router({
    list: protectedProcedure
      .input(z.object({ categoryId: z.number() }))
      .query(async ({ input, ctx }) => {
        const category = await db.getCategoryById(input.categoryId);
        if (!category) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        const section = await db.getSectionById(category.sectionId);
        if (!section || section.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        return await db.getCategoryMediaFiles(input.categoryId);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getMediaFileById(input.id);
      }),
    
    getByShareToken: publicProcedure
      .input(z.object({ shareToken: z.string() }))
      .query(async ({ input }) => {
        return await db.getMediaFileByShareToken(input.shareToken);
      }),
    
    create: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        title: z.string().min(1),
        filename: z.string(),
        fileKey: z.string(),
        fileUrl: z.string(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        mediaType: z.enum(["audio", "video"]),
        lyrics: z.string().optional(),
        musicStyle: z.string().optional(),
        coverArtKey: z.string().optional(),
        coverArtUrl: z.string().optional(),
        displayOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const category = await db.getCategoryById(input.categoryId);
        if (!category) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        const section = await db.getSectionById(category.sectionId);
        if (!section || section.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        // Generate share token
        const shareToken = generateToken(32);
        
        await db.createMediaFile({
          categoryId: input.categoryId,
          userId: ctx.user.id,
          title: input.title,
          filename: input.filename,
          fileKey: input.fileKey,
          fileUrl: input.fileUrl,
          fileSize: input.fileSize || null,
          mimeType: input.mimeType || null,
          mediaType: input.mediaType,
          lyrics: input.lyrics || null,
          musicStyle: input.musicStyle || null,
          coverArtKey: input.coverArtKey || null,
          coverArtUrl: input.coverArtUrl || null,
          shareToken,
          isPubliclyShared: false,
          displayOrder: input.displayOrder || 0,
        });
        
        // Add to activity feed
        await createActivityFeedItem(
          "upload",
          undefined, // We don't have the mediaFileId here
          input.title
        );
        
        // Broadcast upload event to SSE clients
        broadcastActivity("upload", 0, input.title);
        
        return { success: true };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        lyrics: z.string().optional(),
        musicStyle: z.string().optional(),
        coverArtKey: z.string().optional(),
        coverArtUrl: z.string().optional(),
        isPubliclyShared: z.boolean().optional(),
        allowDownload: z.boolean().optional(),
        allowStreaming: z.boolean().optional(),
        artistName: z.string().optional(),
        artistBio: z.string().optional(),
        isrc: z.string().optional(),
        upc: z.string().optional(),
        writerCredits: z.string().optional(),
        isAiAssisted: z.boolean().optional(),
        genres: z.string().optional(),
        moods: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const mediaFile = await db.getMediaFileById(input.id);
        if (!mediaFile || mediaFile.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        const updateData: any = {};
        if (input.title !== undefined) updateData.title = input.title;
        if (input.lyrics !== undefined) updateData.lyrics = input.lyrics;
        if (input.musicStyle !== undefined) updateData.musicStyle = input.musicStyle;
        if (input.coverArtKey !== undefined) updateData.coverArtKey = input.coverArtKey;
        if (input.coverArtUrl !== undefined) updateData.coverArtUrl = input.coverArtUrl;
        if (input.isPubliclyShared !== undefined) updateData.isPubliclyShared = input.isPubliclyShared;
        if (input.allowDownload !== undefined) updateData.allowDownload = input.allowDownload;
        if (input.allowStreaming !== undefined) updateData.allowStreaming = input.allowStreaming;
        if (input.artistName !== undefined) updateData.artistName = input.artistName;
        if (input.artistBio !== undefined) updateData.artistBio = input.artistBio;
        if (input.isrc !== undefined) updateData.isrc = input.isrc;
        if (input.upc !== undefined) updateData.upc = input.upc;
        if (input.writerCredits !== undefined) updateData.writerCredits = input.writerCredits;
        if (input.isAiAssisted !== undefined) updateData.isAiAssisted = input.isAiAssisted;
        if (input.genres !== undefined) updateData.genres = input.genres;
        if (input.moods !== undefined) updateData.moods = input.moods;
        
        await db.updateMediaFile(input.id, updateData);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const mediaFile = await db.getMediaFileById(input.id);
        if (!mediaFile || mediaFile.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        await db.deleteMediaFile(input.id);
        return { success: true };
      }),
    
    getRandomFromCategory: protectedProcedure
      .input(z.object({ categoryId: z.number() }))
      .query(async ({ input, ctx }) => {
        const category = await db.getCategoryById(input.categoryId);
        if (!category) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        const section = await db.getSectionById(category.sectionId);
        if (!section || section.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        const files = await db.getCategoryMediaFiles(input.categoryId);
        if (files.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * files.length);
        return files[randomIndex];
      }),
  }),
  
  // Tags management
  tags: router({
    list: publicProcedure.query(async () => {
      return await db.getAllTags();
    }),
    
    getForMedia: publicProcedure
      .input(z.object({ mediaFileId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMediaFileTags(input.mediaFileId);
      }),
    
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        // Check if tag already exists
        const existing = await db.getTagByName(input.name);
        if (existing) {
          return { success: true, tagId: existing.id };
        }
        
        await db.createTag({
          name: input.name,
          createdById: ctx.user.id,
        });
        const newTag = await db.getTagByName(input.name);
        return { success: true, tagId: newTag?.id };
      }),
    
    addToMedia: protectedProcedure
      .input(z.object({
        mediaFileId: z.number(),
        tagId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.addTagToMediaFile(input.mediaFileId, input.tagId, ctx.user.id);
        return { success: true };
      }),
    
    removeFromMedia: protectedProcedure
      .input(z.object({
        mediaFileId: z.number(),
        tagId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.removeTagFromMediaFile(input.mediaFileId, input.tagId);
        return { success: true };
      }),
  }),
  
  // Ratings
  ratings: router({
    rate: protectedProcedure
      .input(z.object({
        mediaFileId: z.number(),
        rating: z.number().min(1).max(5),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.upsertRating({
          mediaFileId: input.mediaFileId,
          userId: ctx.user.id,
          rating: input.rating,
        });
        return { success: true };
      }),
    
    getAverage: publicProcedure
      .input(z.object({ mediaFileId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMediaFileAverageRating(input.mediaFileId);
      }),
    
    getUserRating: protectedProcedure
      .input(z.object({ mediaFileId: z.number() }))
      .query(async ({ input, ctx }) => {
        return await db.getUserRatingForMediaFile(ctx.user.id, input.mediaFileId);
      }),
  }),
  
  // Comments
  comments: router({
    list: publicProcedure
      .input(z.object({ mediaFileId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMediaFileComments(input.mediaFileId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        mediaFileId: z.number(),
        content: z.string().min(1),
        parentCommentId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Get media file for title
        const mediaFile = await db.getMediaFileById(input.mediaFileId);
        
        await db.createComment({
          mediaFileId: input.mediaFileId,
          userId: ctx.user.id,
          content: input.content,
          parentCommentId: input.parentCommentId || null,
        });
        
        // Add to activity feed
        if (mediaFile) {
          await createActivityFeedItem(
            "comment",
            input.mediaFileId,
            mediaFile.title
          );
        }
        
        // Broadcast comment event to SSE clients
        if (mediaFile) {
          broadcastActivity("comment", input.mediaFileId, mediaFile.title);
        }
        
        return { success: true };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        await db.updateComment(input.id, input.content);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteComment(input.id);
        return { success: true };
      }),
  }),
  
  // API Keys management
  apiKeys: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserApiKeys(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const apiKey = generateApiKey();
        const keyHash = hashApiKey(apiKey);
        
        await db.createApiKey(ctx.user.id, input.name, keyHash);
        
        // Return the plain API key only once
        return { success: true, apiKey };
      }),
  }),

  // Engagement features (voting, analytics, trending)
  engagement: router({
    // Voting endpoints
    vote: publicProcedure
      .input(z.object({
        mediaFileId: z.number(),
        voteType: z.enum(["up", "down"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const ipHash = ctx.req ? getClientIpHash(ctx.req) : "unknown";
        
        // Check rate limit
        const rateCheck = rateLimiter.check(ipHash, "vote");
        if (!rateCheck.allowed) {
          const retryAfter = Math.ceil((rateCheck.resetTime - Date.now()) / 1000);
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          });
        }
        
        // Verify media file exists
        const mediaFile = await db.getMediaFileById(input.mediaFileId);
        if (!mediaFile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Media file not found",
          });
        }
        
        // Record the vote
        const result = await upsertVote(input.mediaFileId, ipHash, input.voteType as VoteType);
        
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to record vote",
          });
        }
        
        // Add to activity feed
        await createActivityFeedItem(
          "vote",
          input.mediaFileId,
          mediaFile.title
        );
        
        // Broadcast to SSE clients
        broadcastActivity("vote", input.mediaFileId, mediaFile.title);
        
        // Get updated counts
        const counts = await getVoteCounts(input.mediaFileId);
        
        return {
          success: true,
          voteType: input.voteType,
          previousVote: result.previousVote,
          upvotes: counts.upvotes,
          downvotes: counts.downvotes,
        };
      }),

    removeVote: publicProcedure
      .input(z.object({ mediaFileId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const ipHash = ctx.req ? getClientIpHash(ctx.req) : "unknown";
        
        const result = await removeVote(input.mediaFileId, ipHash);
        
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to remove vote",
          });
        }
        
        // Get updated counts
        const counts = await getVoteCounts(input.mediaFileId);
        
        return {
          success: true,
          previousVote: result.previousVote,
          upvotes: counts.upvotes,
          downvotes: counts.downvotes,
        };
      }),

    getVoteStatus: publicProcedure
      .input(z.object({ mediaFileId: z.number() }))
      .query(async ({ input, ctx }) => {
        const ipHash = ctx.req ? getClientIpHash(ctx.req) : "unknown";
        
        const vote = await getVoteByIpAndMedia(input.mediaFileId, ipHash);
        
        return {
          currentVote: vote?.voteType as VoteType | null ?? null,
        };
      }),

    getVoteCounts: publicProcedure
      .input(z.object({ mediaFileId: z.number() }))
      .query(async ({ input }) => {
        return await getVoteCounts(input.mediaFileId);
      }),

    // Analytics tracking endpoints
    recordPlay: publicProcedure
      .input(z.object({
        mediaFileId: z.number(),
        playDuration: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const ipHash = ctx.req ? getClientIpHash(ctx.req) : "unknown";
        
        // Check rate limit
        const rateCheck = rateLimiter.check(ipHash, "play");
        if (!rateCheck.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Rate limit exceeded for play tracking",
          });
        }
        
        // Verify media file exists
        const mediaFile = await db.getMediaFileById(input.mediaFileId);
        if (!mediaFile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Media file not found",
          });
        }
        
        // Create play log
        const result = await createPlayLog(input.mediaFileId, ipHash, input.playDuration);
        
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to record play",
          });
        }
        
        // Increment denormalized count
        await incrementPlayCount(input.mediaFileId);
        
        // Add to activity feed
        await createActivityFeedItem(
          "play",
          input.mediaFileId,
          mediaFile.title,
          ipHash
        );
        
        // Broadcast to SSE clients
        broadcastActivity("play", input.mediaFileId, mediaFile.title);
        
        return { success: true };
      }),

    recordDownload: publicProcedure
      .input(z.object({ mediaFileId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const ipHash = ctx.req ? getClientIpHash(ctx.req) : "unknown";
        
        // Check rate limit
        const rateCheck = rateLimiter.check(ipHash, "download");
        if (!rateCheck.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Rate limit exceeded for download tracking",
          });
        }
        
        // Verify media file exists
        const mediaFile = await db.getMediaFileById(input.mediaFileId);
        if (!mediaFile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Media file not found",
          });
        }
        
        // Create download log
        const result = await createDownloadLog(input.mediaFileId, ipHash);
        
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to record download",
          });
        }
        
        // Increment denormalized count
        await incrementDownloadCount(input.mediaFileId);
        
        // Add to activity feed
        await createActivityFeedItem(
          "download",
          input.mediaFileId,
          mediaFile.title,
          ipHash
        );
        
        // Broadcast to SSE clients
        broadcastActivity("download", input.mediaFileId, mediaFile.title);
        
        return { success: true };
      }),

    recordView: publicProcedure
      .input(z.object({ mediaFileId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const ipHash = ctx.req ? getClientIpHash(ctx.req) : "unknown";
        
        // Check rate limit
        const rateCheck = rateLimiter.check(ipHash, "view");
        if (!rateCheck.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Rate limit exceeded for view tracking",
          });
        }
        
        // Verify media file exists
        const mediaFile = await db.getMediaFileById(input.mediaFileId);
        if (!mediaFile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Media file not found",
          });
        }
        
        // Create view log
        const result = await createViewLog(input.mediaFileId, ipHash);
        
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to record view",
          });
        }
        
        // Increment denormalized count
        await incrementViewCount(input.mediaFileId);
        
        return { success: true };
      }),

    getStats: publicProcedure
      .input(z.object({ mediaFileId: z.number() }))
      .query(async ({ input }) => {
        const mediaFile = await db.getMediaFileById(input.mediaFileId);
        if (!mediaFile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Media file not found",
          });
        }
        
        const voteCounts = await getVoteCounts(input.mediaFileId);
        
        return {
          playCount: mediaFile.playCount,
          downloadCount: mediaFile.downloadCount,
          viewCount: mediaFile.viewCount,
          upvotes: voteCounts.upvotes,
          downvotes: voteCounts.downvotes,
          hotnessScore: mediaFile.hotnessScore,
        };
      }),

    // Trending and popular endpoints
    getTrending: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).default(10),
      }))
      .query(async ({ input }) => {
        return await getTrendingMedia(input.limit);
      }),

    getPopular: publicProcedure
      .input(z.object({
        period: z.enum(["24h", "7d", "30d", "all"]).default("all"),
        limit: z.number().min(1).max(50).default(10),
      }))
      .query(async ({ input }) => {
        return await getPopularMedia(input.period as TimePeriod, input.limit);
      }),

    getHot: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).default(10),
      }))
      .query(async ({ input }) => {
        return await getHotMedia(input.limit);
      }),

    // Activity feed endpoint
    getRecentActivity: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).default(20),
      }))
      .query(async ({ input }) => {
        return await getRecentActivity(input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
