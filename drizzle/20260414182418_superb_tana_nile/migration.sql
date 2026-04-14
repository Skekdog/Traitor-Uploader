ALTER TABLE `assets` ADD `group_id` text NOT NULL REFERENCES groups(id);--> statement-breakpoint
ALTER TABLE `groups` ADD `key` text NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `isAdmin` integer DEFAULT false NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_groups` (
	`id` text PRIMARY KEY UNIQUE,
	`key` text NOT NULL,
	`isAdmin` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_groups`(`id`) SELECT `id` FROM `groups`;--> statement-breakpoint
DROP TABLE `groups`;--> statement-breakpoint
ALTER TABLE `__new_groups` RENAME TO `groups`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY UNIQUE,
	`roblox_user_id` text NOT NULL UNIQUE
);
--> statement-breakpoint
INSERT INTO `__new_users`(`id`, `roblox_user_id`) SELECT `id`, `roblox_user_id` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_assets` (
	`id` text PRIMARY KEY,
	`roblox_id` text NOT NULL UNIQUE,
	`group_id` text NOT NULL,
	CONSTRAINT `fk_assets_group_id_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_assets`(`id`, `roblox_id`) SELECT `id`, `roblox_id` FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users_to_groups` (
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	CONSTRAINT `users_to_groups_pk` PRIMARY KEY(`user_id`, `group_id`),
	CONSTRAINT `fk_users_to_groups_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_users_to_groups_group_id_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_users_to_groups`(`user_id`, `group_id`) SELECT `user_id`, `group_id` FROM `users_to_groups`;--> statement-breakpoint
DROP TABLE `users_to_groups`;--> statement-breakpoint
ALTER TABLE `__new_users_to_groups` RENAME TO `users_to_groups`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP TABLE `keys`;