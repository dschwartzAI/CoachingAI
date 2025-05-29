

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "text" NOT NULL,
    "content" "text" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "user_id" "text" NOT NULL,
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."threads" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "tool_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "valid_tool_id" CHECK ((("tool_id" IS NULL) OR ("tool_id" = ANY (ARRAY['hybrid-offer'::"text", 'workshop-generator'::"text", 'highlevel-landing-page'::"text", 'marketing-audit'::"text", 'business-plan'::"text"]))))
);


ALTER TABLE "public"."threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_name" "text",
    "business_type" "text",
    "target_audience" "text",
    "business_description" "text",
    "goals" "text",
    "challenges" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text",
    "occupation" "text",
    "desired_mrr" "text",
    "desired_hours" "text"
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_messages_thread_id" ON "public"."messages" USING "btree" ("thread_id");



CREATE INDEX "idx_messages_user_id" ON "public"."messages" USING "btree" ("user_id");



CREATE INDEX "idx_threads_user_id" ON "public"."threads" USING "btree" ("user_id");



CREATE INDEX "user_profiles_user_id_idx" ON "public"."user_profiles" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "handle_threads_updated_at" BEFORE UPDATE ON "public"."threads" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete their own messages" ON "public"."messages" FOR DELETE USING (((("auth"."uid"())::"text" = "user_id") OR ("user_id" ~~ 'anon-%'::"text")));



CREATE POLICY "Users can delete their own threads" ON "public"."threads" FOR DELETE USING (((("auth"."uid"())::"text" = "user_id") OR ("user_id" ~~ 'anon-%'::"text")));



CREATE POLICY "Users can insert messages for their own threads" ON "public"."messages" FOR INSERT WITH CHECK ((((("auth"."uid"())::"text" = "user_id") OR ("user_id" ~~ 'anon-%'::"text")) AND (EXISTS ( SELECT 1
   FROM "public"."threads"
  WHERE (("threads"."id" = "messages"."thread_id") AND (("threads"."user_id" = ("auth"."uid"())::"text") OR ("threads"."user_id" ~~ 'anon-%'::"text")))))));



CREATE POLICY "Users can insert their own threads" ON "public"."threads" FOR INSERT WITH CHECK (((("auth"."uid"())::"text" = "user_id") OR ("user_id" ~~ 'anon-%'::"text")));



CREATE POLICY "Users can update their own messages" ON "public"."messages" FOR UPDATE USING (((("auth"."uid"())::"text" = "user_id") OR ("user_id" ~~ 'anon-%'::"text")));



CREATE POLICY "Users can update their own threads" ON "public"."threads" FOR UPDATE USING (((("auth"."uid"())::"text" = "user_id") OR ("user_id" ~~ 'anon-%'::"text")));



CREATE POLICY "Users can view and manage their own profiles" ON "public"."user_profiles" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view messages in their threads" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."threads"
  WHERE (("threads"."id" = "messages"."thread_id") AND (("threads"."user_id" = ("auth"."uid"())::"text") OR ("threads"."user_id" ~~ 'anon-%'::"text"))))));



CREATE POLICY "Users can view their own messages" ON "public"."messages" FOR SELECT USING (((("auth"."uid"())::"text" = "user_id") OR ("user_id" ~~ 'anon-%'::"text")));



CREATE POLICY "Users can view their own threads" ON "public"."threads" FOR SELECT USING (((("auth"."uid"())::"text" = "user_id") OR ("user_id" ~~ 'anon-%'::"text")));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."threads" TO "anon";
GRANT ALL ON TABLE "public"."threads" TO "authenticated";
GRANT ALL ON TABLE "public"."threads" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
