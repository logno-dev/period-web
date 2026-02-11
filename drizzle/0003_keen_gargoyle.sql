CREATE TABLE `mood_markers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`mood` text NOT NULL,
	`created_at` integer DEFAULT '"2026-02-11T00:06:57.658Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2026-02-11T00:06:57.658Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
ALTER TABLE `periods` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT '"2026-02-11T00:06:57.658Z"';--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `periods` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT '"2026-02-11T00:06:57.658Z"';--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL DEFAULT '"2026-02-11T00:06:57.658Z"';--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL DEFAULT '"2026-02-11T00:06:57.658Z"';