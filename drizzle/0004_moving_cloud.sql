ALTER TABLE users ADD COLUMN push_notifications_enabled integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN push_subscription text;
