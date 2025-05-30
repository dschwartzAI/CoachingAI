import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { threadsTable } from "./threads-schema";

export const memoryTypeEnum = pgEnum("memory_type", [
  "episodic",
  "fact",
  "preference",
  "artefact"
]);

export const userMemoriesTable = pgTable("user_memories", {
  id: text("id").defaultRandom().primaryKey(),
  user_id: text("user_id").notNull(),
  thread_id: text("thread_id")
    .references(() => threadsTable.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  type: memoryTypeEnum("type").notNull(),
  embedding: text("embedding"),
  created_at: timestamp("created_at").defaultNow()
});

export const getUserMemoriesTableWithTypescript = () => {
  return {
    $inferInsert: {},
    $inferSelect: {}
  };
};
