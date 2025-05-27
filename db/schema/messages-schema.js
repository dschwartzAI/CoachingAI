import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { threadsTable } from "./threads-schema";

export const roleEnum = pgEnum("role", ["system", "assistant", "user", "function"]);

export const messagesTable = pgTable("messages", {
  id: text("id").defaultRandom().primaryKey(),
  thread_id: text("thread_id")
    .references(() => threadsTable.id, { onDelete: "cascade" })
    .notNull(),
  role: roleEnum("role").notNull(),
  content: text("content").notNull(),
  user_id: text("user_id").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  metadata: text("metadata")
});

export const getMessagesTableWithTypescript = () => {
  return {
    $inferInsert: {},
    $inferSelect: {}
  };
}; 