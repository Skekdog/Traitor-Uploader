CREATE TABLE `assets` (
	`id` text PRIMARY KEY,
	`roblox_id` text NOT NULL UNIQUE,
	`key` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY,
	`name` text
);
--> statement-breakpoint
CREATE TABLE `keys` (
	`id` text PRIMARY KEY,
	`key` text UNIQUE,
	`owner_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`roblox_user_id` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE `users_to_groups` (
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	CONSTRAINT `users_to_groups_pk` PRIMARY KEY(`user_id`, `group_id`),
	CONSTRAINT `fk_users_to_groups_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_users_to_groups_group_id_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`)
);
