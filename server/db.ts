// Ayo we bout to get this database poppin' like it's Friday night at the club 🔥
import { eq, and, desc, sql, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser, users, adminCredentials, apiKeys, sections, categories,
  mediaFiles, tags, mediaFileTags, ratings, comments,
  InsertSection, InsertCategory, InsertMediaFile, InsertTag, InsertRating, InsertComment
} from "../drizzle/schema";
import { ENV } from './_core/env';

// These our main homies - they null til we call em up
let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

// Aight bet, let's see if the database be home or nah
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // We connectin' wit dat SSL drip - can't be havin no hackers up in here
      _client = postgres(process.env.DATABASE_URL, { ssl: 'require' });
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== User Management =====
// Where we keep track of all da real ones in the system fr fr

// This function do be slidin users into the database smooth like butter
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    // Bruh you ain't even got an ID?? You can't sit with us 💀
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    // All the tea we collectin bout this person no cap
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      // Oh snap it's the big boss man - automatic VIP treatment 👑
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== Admin Credentials =====
// The secret sauce for them boss level peeps only 🔐

export async function getAdminCredentialByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(adminCredentials).where(eq(adminCredentials.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Makin a new admin be like handing out keys to the kingdom fam
export async function createAdminCredential(username: string, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(adminCredentials).values({ username, passwordHash });
}

// ===== API Keys =====
// The golden tickets to get in da club - don't lose these joints 🎫

export async function createApiKey(userId: number, name: string, keyHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(apiKeys).values({ userId, name, keyHash });
  return result;
}

export async function getApiKeyByHash(keyHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(apiKeys).where(
    and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true))
  ).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Stamp dat timestamp like we checking who came thru the function 📝
export async function updateApiKeyLastUsed(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
}

export async function getUserApiKeys(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
}

// ===== Sections =====
// Big chunky pieces of content - like slices of pizza but for data 🍕

export async function createSection(data: InsertSection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(sections).values(data);
  return result;
}

export async function getUserSections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(sections).where(eq(sections.userId, userId)).orderBy(asc(sections.displayOrder));
}

export async function getSectionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(sections).where(eq(sections.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateSection(id: number, data: Partial<InsertSection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(sections).set(data).where(eq(sections.id, id));
}

// Yeet that section into the shadow realm 🗑️
export async function deleteSection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(sections).where(eq(sections.id, id));
}

// ===== Categories =====
// Where we organize the goods - gotta keep it tidy like mama taught us 📦

export async function createCategory(data: InsertCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(categories).values(data);
  return result;
}

export async function getSectionCategories(sectionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(categories).where(eq(categories.sectionId, sectionId)).orderBy(asc(categories.displayOrder));
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateCategory(id: number, data: Partial<InsertCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(categories).set(data).where(eq(categories.id, id));
}

// This category boutta catch these hands and get deleted real quick ✌️
export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(categories).where(eq(categories.id, id));
}

// ===== Media Files =====
// The actual fire content - this where the bangers live 🎵🎬

export async function createMediaFile(data: InsertMediaFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(mediaFiles).values(data);
  return result;
}

export async function getCategoryMediaFiles(categoryId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(mediaFiles).where(eq(mediaFiles.categoryId, categoryId)).orderBy(asc(mediaFiles.displayOrder));
}

export async function getMediaFileById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Got dat special link? Aight lemme see if you really bout that life 🔗
export async function getMediaFileByShareToken(shareToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(mediaFiles).where(
    and(eq(mediaFiles.shareToken, shareToken), eq(mediaFiles.isPubliclyShared, true))
  ).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateMediaFile(id: number, data: Partial<InsertMediaFile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(mediaFiles).set(data).where(eq(mediaFiles.id, id));
}

// Peace out lil homie, you been evicted from the database 👋
export async function deleteMediaFile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(mediaFiles).where(eq(mediaFiles.id, id));
}

// ===== Tags =====
// Hashtag gang gang - we labelin everything out here #blessed #organized 🏷️

export async function createTag(data: InsertTag) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tags).values(data);
  return result;
}

export async function getTagByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllTags() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(tags).orderBy(asc(tags.name));
}

export async function getMediaFileTags(mediaFileId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: tags.id,
      name: tags.name,
      createdById: tags.createdById,
      createdAt: tags.createdAt,
      addedById: mediaFileTags.addedById,
      addedAt: mediaFileTags.createdAt,
    })
    .from(mediaFileTags)
    .innerJoin(tags, eq(mediaFileTags.tagId, tags.id))
    .where(eq(mediaFileTags.mediaFileId, mediaFileId));
  
  return result;
}

// Slappin a tag on this bad boy like graffiti on a train 🎨
export async function addTagToMediaFile(mediaFileId: number, tagId: number, addedById: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(mediaFileTags).values({ mediaFileId, tagId, addedById });
}

// Rip that tag off like it's a price sticker and this is a gift 🎁
export async function removeTagFromMediaFile(mediaFileId: number, tagId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(mediaFileTags).where(
    and(eq(mediaFileTags.mediaFileId, mediaFileId), eq(mediaFileTags.tagId, tagId))
  );
}

// ===== Ratings =====
// Where the haters and the lovers leave their marks - we see you 👀⭐

// Drop your rating fam - but if you already rated, we just update that vibe
export async function upsertRating(data: InsertRating) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(ratings).values(data).onConflictDoUpdate({
    target: [ratings.userId, ratings.mediaFileId],
    set: { rating: data.rating, updatedAt: new Date() },
  });
}

export async function getMediaFileRatings(mediaFileId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(ratings).where(eq(ratings.mediaFileId, mediaFileId));
}

// Time to do some math and see what the streets really think 📊
export async function getMediaFileAverageRating(mediaFileId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select({
      average: sql<number>`AVG(${ratings.rating})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(ratings)
    .where(eq(ratings.mediaFileId, mediaFileId));
  
  return result[0] || null;
}

export async function getUserRatingForMediaFile(userId: number, mediaFileId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(ratings).where(
    and(eq(ratings.userId, userId), eq(ratings.mediaFileId, mediaFileId))
  ).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== Comments =====
// Where everybody drops their hot takes and opinions like it's Twitter 🗣️💬

// Speak ya mind fam, we ain't censoring nobody (unless you wildin) 🎤
export async function createComment(data: InsertComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(comments).values(data);
  return result;
}

export async function getMediaFileComments(mediaFileId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const allComments = await db
    .select({
      id: comments.id,
      mediaFileId: comments.mediaFileId,
      userId: comments.userId,
      parentCommentId: comments.parentCommentId,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.mediaFileId, mediaFileId))
    .orderBy(asc(comments.createdAt));
  
  return allComments;
}

export async function updateComment(id: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(comments).set({ content, updatedAt: new Date() }).where(eq(comments.id, id));
}

// Oop you said something crazy - let's make that disappear real quick 🫥
export async function deleteComment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(comments).where(eq(comments.id, id));
}
