DROP INDEX "users_email_unique";--> statement-breakpoint
ALTER TABLE `periods` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT '"2025-10-26T05:41:05.206Z"';--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `periods` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT '"2025-10-26T05:41:05.206Z"';--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT '"2025-10-26T05:41:05.205Z"';--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT '"2025-10-26T05:41:05.205Z"';--> statement-breakpoint
ALTER TABLE `users` ADD `notifications_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notification_emails` text;