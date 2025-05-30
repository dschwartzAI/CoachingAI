import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const memorySummariesTable = pgTable("memory_summaries", {
  user_id: text("user_id").primaryKey(),
  summary: text("summary"),
  updated_at: timestamp("updated_at").defaultNow()
});

export const getMemorySummariesTableWithTypescript = () => {
  return {
    $inferInsert: {},
    $inferSelect: {}
  };
};
