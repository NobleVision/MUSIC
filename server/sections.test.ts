import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

function createAuthContext(userId: number = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "admin",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("sections", () => {
  let testSectionId: number;

  it("should create a new section", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sections.create({
      name: "Test Section",
      description: "A test section for vitest",
    });

    expect(result.success).toBe(true);

    // Verify it was created
    const sections = await caller.sections.list();
    const createdSection = sections.find(s => s.name === "Test Section");
    expect(createdSection).toBeDefined();
    if (createdSection) {
      testSectionId = createdSection.id;
    }
  });

  it("should list user sections", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const sections = await caller.sections.list();

    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThan(0);
  });

  it("should update a section", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    if (!testSectionId) {
      // Create a section first
      await caller.sections.create({
        name: "Update Test Section",
        description: "Original description",
      });
      const sections = await caller.sections.list();
      const section = sections.find(s => s.name === "Update Test Section");
      testSectionId = section!.id;
    }

    const result = await caller.sections.update({
      id: testSectionId,
      name: "Updated Section Name",
      description: "Updated description",
    });

    expect(result.success).toBe(true);

    // Verify the update
    const section = await db.getSectionById(testSectionId);
    expect(section?.name).toBe("Updated Section Name");
    expect(section?.description).toBe("Updated description");
  });

  it("should delete a section", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a section to delete
    await caller.sections.create({
      name: "Delete Test Section",
      description: "To be deleted",
    });
    const sections = await caller.sections.list();
    const section = sections.find(s => s.name === "Delete Test Section");
    const sectionId = section!.id;

    const result = await caller.sections.delete({ id: sectionId });

    expect(result.success).toBe(true);

    // Verify it was deleted
    const deletedSection = await db.getSectionById(sectionId);
    expect(deletedSection).toBeUndefined();
  });

  it("should prevent unauthorized section access", async () => {
    const ctx1 = createAuthContext(1);
    const caller1 = appRouter.createCaller(ctx1);

    // Create section as user 1
    await caller1.sections.create({
      name: "User 1 Section",
      description: "Private section",
    });
    const sections = await caller1.sections.list();
    const section = sections.find(s => s.name === "User 1 Section");
    const sectionId = section!.id;

    // Try to delete as user 2
    const ctx2 = createAuthContext(2);
    const caller2 = appRouter.createCaller(ctx2);

    await expect(
      caller2.sections.delete({ id: sectionId })
    ).rejects.toThrow();
  });
});

describe("categories", () => {
  let testSectionId: number;
  let testCategoryId: number;

  beforeAll(async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a section for category tests
    await caller.sections.create({
      name: "Category Test Section",
      description: "For testing categories",
    });
    const sections = await caller.sections.list();
    const section = sections.find(s => s.name === "Category Test Section");
    testSectionId = section!.id;
  });

  it("should create a new category", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.categories.create({
      sectionId: testSectionId,
      name: "Test Category",
      description: "A test category",
    });

    expect(result.success).toBe(true);

    // Verify it was created
    const categories = await caller.categories.list({ sectionId: testSectionId });
    const createdCategory = categories.find(c => c.name === "Test Category");
    expect(createdCategory).toBeDefined();
    if (createdCategory) {
      testCategoryId = createdCategory.id;
    }
  });

  it("should list categories in a section", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const categories = await caller.categories.list({ sectionId: testSectionId });

    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
  });

  it("should update a category", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    if (!testCategoryId) {
      await caller.categories.create({
        sectionId: testSectionId,
        name: "Update Test Category",
        description: "Original",
      });
      const categories = await caller.categories.list({ sectionId: testSectionId });
      const category = categories.find(c => c.name === "Update Test Category");
      testCategoryId = category!.id;
    }

    const result = await caller.categories.update({
      id: testCategoryId,
      name: "Updated Category Name",
    });

    expect(result.success).toBe(true);

    const category = await db.getCategoryById(testCategoryId);
    expect(category?.name).toBe("Updated Category Name");
  });

  it("should delete a category", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.categories.create({
      sectionId: testSectionId,
      name: "Delete Test Category",
      description: "To be deleted",
    });
    const categories = await caller.categories.list({ sectionId: testSectionId });
    const category = categories.find(c => c.name === "Delete Test Category");
    const categoryId = category!.id;

    const result = await caller.categories.delete({ id: categoryId });

    expect(result.success).toBe(true);

    const deletedCategory = await db.getCategoryById(categoryId);
    expect(deletedCategory).toBeUndefined();
  });
});
