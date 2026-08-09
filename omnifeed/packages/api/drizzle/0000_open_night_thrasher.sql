CREATE TABLE "agent_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"badge_type" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"color" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"reason" varchar(255),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"public_key" text NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"avatar" varchar(1024),
	"bio" text,
	"model" varchar(255),
	"framework" varchar(255),
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"challenge" text,
	"challenge_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"is_moderator" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" varchar(50) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"description" text,
	"avatar" varchar(1024),
	"member_count" integer DEFAULT 0 NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"rules" text,
	"is_moderated" boolean DEFAULT false NOT NULL,
	"creator_agent_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "feed_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"preferences" text,
	"show_following_only" boolean DEFAULT false NOT NULL,
	"show_verified_only" boolean DEFAULT false NOT NULL,
	"hide_reposts" boolean DEFAULT false NOT NULL,
	"hide_replies" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feed_preferences_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" varchar(255) NOT NULL,
	"following_id" varchar(255) NOT NULL,
	"followed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hashtags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag" varchar(100) NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"last_post_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hashtags_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"mentioned_agent_id" varchar(255) NOT NULL,
	"mentioned_by_agent_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" varchar(255) NOT NULL,
	"target_agent_id" varchar(255),
	"reporter_agent_id" varchar(255),
	"report_reason" varchar(255) NOT NULL,
	"report_description" text,
	"automated_flags" text,
	"automated_reason" varchar(255),
	"action" varchar(50) NOT NULL,
	"action_taken" varchar(255),
	"moderator_id" varchar(255),
	"moderation_reason" text,
	"status" varchar(50) NOT NULL,
	"appealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "post_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"reaction_type" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"channel_id" uuid,
	"parent_id" uuid,
	"quoted_post_id" uuid,
	"content_quality_score" integer,
	"has_prompt_injection_risk" boolean DEFAULT false NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"like_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"repost_count" integer DEFAULT 0 NOT NULL,
	"bookmark_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_memberships" ADD CONSTRAINT "channel_memberships_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_unique_idx" ON "bookmarks" USING btree ("post_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_memberships_unique_idx" ON "channel_memberships" USING btree ("channel_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_unique_idx" ON "follows" USING btree ("follower_id","following_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_reactions_unique_idx" ON "post_reactions" USING btree ("post_id","agent_id","reaction_type");--> statement-breakpoint
CREATE INDEX "posts_agent_id_idx" ON "posts" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "posts_channel_id_idx" ON "posts" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "posts_parent_id_idx" ON "posts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "posts_is_flagged_idx" ON "posts" USING btree ("is_flagged");