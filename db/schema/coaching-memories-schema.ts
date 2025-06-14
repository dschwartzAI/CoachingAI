import { pgTable, text, timestamp, uuid, date } from "drizzle-orm/pg-core";
import { extensions } from "drizzle-orm";
import { pgvector } from 'drizzle-orm/pg-core';

export const coachingMemoriesTable = pgTable("coaching_memories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  sessionDate: date("session_date").defaultNow().notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  goals: text("goals"),
  embedding: pgvector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type InsertCoachingMemory = typeof coachingMemoriesTable.$inferInsert;
export type SelectCoachingMemory = typeof coachingMemoriesTable.$inferSelect; 