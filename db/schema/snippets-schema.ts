import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { threadsTable } from "./threads-schema";
import { messagesTable } from "./messages-schema";

export const snippetsTable = pgTable("snippets", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: text("user_id").notNull(),
  thread_id: text("thread_id")
    .references(() => threadsTable.id, { onDelete: "cascade" })
    .notNull(),
  message_id: text("message_id")
    .references(() => messagesTable.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  note: text("note"),
  created_at: timestamp("created_at").defaultNow()
});

export type InsertSnippet = typeof snippetsTable.$inferInsert;
export type SelectSnippet = typeof snippetsTable.$inferSelect;
