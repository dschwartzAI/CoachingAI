import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const threadsTable = pgTable("threads", {
  id: text("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  user_id: text("user_id").notNull(),
  tool_id: text("tool_id"),
  metadata: text("metadata"),
  has_custom_title: boolean("has_custom_title").notNull().default(false),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
});

export const getThreadsTableWithTypescript = () => {
  return {
    $inferInsert: {},
    $inferSelect: {}
  };
};
