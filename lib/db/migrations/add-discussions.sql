-- Additive migration for existing Campus Echo databases. Apply once.
BEGIN;
CREATE TABLE "discussion_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"reason" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "discussions" (
	"id" serial PRIMARY KEY NOT NULL,
	"campus_id" integer NOT NULL,
	"post_id" integer,
	"user_id" text NOT NULL,
	"content" varchar(1000) NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "discussions_content_nonempty" CHECK (length(trim("discussions"."content")) > 0)
);

ALTER TABLE "discussion_reports" ADD CONSTRAINT "discussion_reports_message_id_discussions_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "discussion_reports" ADD CONSTRAINT "discussion_reports_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "discussions" ADD CONSTRAINT "discussions_campus_id_campus_hubs_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campus_hubs"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "discussions" ADD CONSTRAINT "discussions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "discussions" ADD CONSTRAINT "discussions_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "discussion_reports_message_user_unique" ON "discussion_reports" USING btree ("message_id","user_id");

CREATE INDEX "discussions_campus_post_created_idx" ON "discussions" USING btree ("campus_id","post_id","created_at");

CREATE INDEX "discussions_expiration_idx" ON "discussions" USING btree ("expires_at");

CREATE INDEX "discussions_user_created_idx" ON "discussions" USING btree ("user_id","created_at");
COMMIT;
