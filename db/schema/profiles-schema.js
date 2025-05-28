import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userProfilesTable = pgTable("user_profiles", {
  id: text("id").defaultRandom().primaryKey(),
  user_id: text("user_id").notNull().unique(),
  business_name: text("business_name"),
  business_type: text("business_type"),
  target_audience: text("target_audience"),
  business_description: text("business_description"),
  goals: text("goals"),
  challenges: text("challenges"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
});

export const getUserProfilesTableWithJavascript = () => {
  return {
    $inferInsert: {},
    $inferSelect: {}
  };
}; 