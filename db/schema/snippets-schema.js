import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const snippetsTable = pgTable("snippets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  note: text("note"),
  tag: text("tag"),
  sourceType: text("source_type").notNull(), // 'conversation', 'document', etc.
  sourceId: text("source_id"), // thread/chat ID or document ID
  sourceContext: text("source_context"), // Additional context about where it came from
  messageId: text("message_id"), // Specific message ID if from conversation
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
}) 