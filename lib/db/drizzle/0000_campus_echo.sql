CREATE TABLE "campus_hubs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"radius_km" double precision DEFAULT 2 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"text" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" serial PRIMARY KEY NOT NULL,
	"campus_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"question" varchar(200) NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "polls_question_nonempty" CHECK (length(trim("polls"."question")) > 0)
);
--> statement-breakpoint
CREATE TABLE "post_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_votes_value_valid" CHECK ("post_votes"."value" IN (-1, 1))
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"campus_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"content" varchar(280) NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "posts_content_nonempty" CHECK (length(trim("posts"."content")) > 0)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"alias" varchar(48) NOT NULL,
	"student_verified" boolean DEFAULT false NOT NULL,
	"student_email_domain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar_blocks" (
	"blocker_user_id" text NOT NULL,
	"blocked_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "radar_blocks_pk" PRIMARY KEY("blocker_user_id","blocked_user_id"),
	CONSTRAINT "radar_blocks_not_self" CHECK ("radar_blocks"."blocker_user_id" <> "radar_blocks"."blocked_user_id")
);
--> statement-breakpoint
CREATE TABLE "radar_chats" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ping_id" uuid NOT NULL,
	"participant_one_user_id" text NOT NULL,
	"participant_two_user_id" text NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "radar_chats_ping_id_unique" UNIQUE("ping_id"),
	CONSTRAINT "radar_chats_status_valid" CHECK ("radar_chats"."status" IN ('active', 'closed')),
	CONSTRAINT "radar_chats_distinct_participants" CHECK ("radar_chats"."participant_one_user_id" <> "radar_chats"."participant_two_user_id")
);
--> statement-breakpoint
CREATE TABLE "radar_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"chat_id" uuid NOT NULL,
	"sender_user_id" text NOT NULL,
	"text" varchar(500) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "radar_messages_nonempty" CHECK (length(trim("radar_messages"."text")) > 0)
);
--> statement-breakpoint
CREATE TABLE "radar_pings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sender_user_id" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "radar_pings_status_valid" CHECK ("radar_pings"."status" IN ('pending', 'accepted', 'declined', 'expired')),
	CONSTRAINT "radar_pings_not_self" CHECK ("radar_pings"."sender_user_id" <> "radar_pings"."recipient_user_id")
);
--> statement-breakpoint
CREATE TABLE "radar_presence" (
	"user_id" text PRIMARY KEY NOT NULL,
	"campus_id" integer NOT NULL,
	"blip_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy_meters" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "radar_presence_blip_id_unique" UNIQUE("blip_id"),
	CONSTRAINT "radar_presence_accuracy_valid" CHECK ("radar_presence"."accuracy_meters" BETWEEN 0 AND 75),
	CONSTRAINT "radar_presence_coordinates_valid" CHECK ("radar_presence"."latitude" BETWEEN -90 AND 90 AND "radar_presence"."longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE "radar_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reported_user_id" text NOT NULL,
	"source" varchar(16) NOT NULL,
	"reason" varchar(16) NOT NULL,
	"details" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "radar_reports_source_valid" CHECK ("radar_reports"."source" IN ('radar', 'chat')),
	CONSTRAINT "radar_reports_reason_valid" CHECK ("radar_reports"."reason" IN ('harassment', 'unsafe', 'spam', 'other')),
	CONSTRAINT "radar_reports_not_self" CHECK ("radar_reports"."reporter_user_id" <> "radar_reports"."reported_user_id")
);
--> statement-breakpoint
CREATE TABLE "radar_socket_tickets" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"reason" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_reports" ADD CONSTRAINT "poll_reports_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_reports" ADD CONSTRAINT "poll_reports_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_campus_id_campus_hubs_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campus_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reports" ADD CONSTRAINT "post_reports_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reports" ADD CONSTRAINT "post_reports_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_votes" ADD CONSTRAINT "post_votes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_votes" ADD CONSTRAINT "post_votes_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_campus_id_campus_hubs_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campus_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_blocks" ADD CONSTRAINT "radar_blocks_blocker_user_id_profiles_user_id_fk" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_blocks" ADD CONSTRAINT "radar_blocks_blocked_user_id_profiles_user_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_chats" ADD CONSTRAINT "radar_chats_ping_id_radar_pings_id_fk" FOREIGN KEY ("ping_id") REFERENCES "public"."radar_pings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_chats" ADD CONSTRAINT "radar_chats_participant_one_user_id_profiles_user_id_fk" FOREIGN KEY ("participant_one_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_chats" ADD CONSTRAINT "radar_chats_participant_two_user_id_profiles_user_id_fk" FOREIGN KEY ("participant_two_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_messages" ADD CONSTRAINT "radar_messages_chat_id_radar_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."radar_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_messages" ADD CONSTRAINT "radar_messages_sender_user_id_profiles_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_pings" ADD CONSTRAINT "radar_pings_sender_user_id_profiles_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_pings" ADD CONSTRAINT "radar_pings_recipient_user_id_profiles_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_presence" ADD CONSTRAINT "radar_presence_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_presence" ADD CONSTRAINT "radar_presence_campus_id_campus_hubs_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campus_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_reports" ADD CONSTRAINT "radar_reports_reporter_user_id_profiles_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_reports" ADD CONSTRAINT "radar_reports_reported_user_id_profiles_user_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_socket_tickets" ADD CONSTRAINT "radar_socket_tickets_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_reports" ADD CONSTRAINT "discussion_reports_message_id_discussions_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_reports" ADD CONSTRAINT "discussion_reports_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_campus_id_campus_hubs_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campus_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campus_hubs_name_unique" ON "campus_hubs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "poll_options_poll_idx" ON "poll_options" USING btree ("poll_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_reports_poll_user_unique" ON "poll_reports" USING btree ("poll_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_votes_poll_user_unique" ON "poll_votes" USING btree ("poll_id","user_id");--> statement-breakpoint
CREATE INDEX "polls_campus_created_idx" ON "polls" USING btree ("campus_id","created_at");--> statement-breakpoint
CREATE INDEX "polls_expiration_idx" ON "polls" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "post_reports_post_user_unique" ON "post_reports" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_votes_post_user_unique" ON "post_votes" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE INDEX "posts_campus_created_idx" ON "posts" USING btree ("campus_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_expiration_idx" ON "posts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "radar_chats_participant_one_idx" ON "radar_chats" USING btree ("participant_one_user_id");--> statement-breakpoint
CREATE INDEX "radar_chats_participant_two_idx" ON "radar_chats" USING btree ("participant_two_user_id");--> statement-breakpoint
CREATE INDEX "radar_messages_chat_sent_idx" ON "radar_messages" USING btree ("chat_id","sent_at");--> statement-breakpoint
CREATE INDEX "radar_pings_sender_created_idx" ON "radar_pings" USING btree ("sender_user_id","created_at");--> statement-breakpoint
CREATE INDEX "radar_pings_recipient_created_idx" ON "radar_pings" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_pings_one_pending_pair_unique" ON "radar_pings" USING btree ("sender_user_id","recipient_user_id") WHERE "radar_pings"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "radar_presence_campus_expiration_idx" ON "radar_presence" USING btree ("campus_id","expires_at");--> statement-breakpoint
CREATE INDEX "radar_presence_expiration_idx" ON "radar_presence" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "radar_reports_created_idx" ON "radar_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "radar_reports_target_created_idx" ON "radar_reports" USING btree ("reported_user_id","created_at");--> statement-breakpoint
CREATE INDEX "radar_socket_tickets_expiration_idx" ON "radar_socket_tickets" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "discussion_reports_message_user_unique" ON "discussion_reports" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "discussions_campus_post_created_idx" ON "discussions" USING btree ("campus_id","post_id","created_at");--> statement-breakpoint
CREATE INDEX "discussions_expiration_idx" ON "discussions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "discussions_user_created_idx" ON "discussions" USING btree ("user_id","created_at");