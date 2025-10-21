CREATE TABLE `periods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`created_at` integer DEFAULT '"2025-10-21T19:51:43.519Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2025-10-21T19:51:43.519Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`created_at` integer DEFAULT '"2025-10-21T19:51:43.518Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2025-10-21T19:51:43.518Z"' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);