CREATE TABLE `cache` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL,
	`etag` text
);
--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_records_kind_updated` ON `records` (`kind`,`updated_at`);