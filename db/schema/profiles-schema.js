import { pgTable, text, timestamp, uuid, boolean, integer } from "drizzle-orm/pg-core";

export const userProfilesTable = pgTable("user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: text("user_id").notNull().unique(),
  full_name: text("full_name"),
  occupation: text("occupation"),
  current_mrr: integer("current_mrr"),
  desired_mrr: integer("desired_mrr"),
  desired_hours: integer("desired_hours"),
  business_stage: text("business_stage"),
  biggest_challenge: text("biggest_challenge"),
  primary_goal: text("primary_goal"),
  allow_memory: boolean("allow_memory").default(true).notNull(),
  business_name: text("business_name"),
  business_type: text("business_type"),
  target_audience: text("target_audience"),
  business_description: text("business_description"),
  goals: text("goals"),
  challenges: text("challenges"),
  ideal_client_profile: text("ideal_client_profile"),
  ideal_client_profile_updated_at: timestamp("ideal_client_profile_updated_at"),
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

 
