PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_keys` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL UNIQUE,
	`owner_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_keys`(`id`, `key`, `owner_id`) SELECT `id`, `key`, `owner_id` FROM `keys`;--> statement-breakpoint
DROP TABLE `keys`;--> statement-breakpoint
ALTER TABLE `__new_keys` RENAME TO `keys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;