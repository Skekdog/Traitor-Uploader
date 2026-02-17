PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_assets` (
	`id` text PRIMARY KEY,
	`roblox_id` text NOT NULL UNIQUE,
	`key` text NOT NULL,
	CONSTRAINT `fk_assets_key_keys_key_fk` FOREIGN KEY (`key`) REFERENCES `keys`(`key`)
);
--> statement-breakpoint
INSERT INTO `__new_assets`(`id`, `roblox_id`, `key`) SELECT `id`, `roblox_id`, `key` FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_keys` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL UNIQUE,
	`owner_id` text NOT NULL,
	CONSTRAINT `fk_keys_owner_id_groups_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `groups`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_keys`(`id`, `key`, `owner_id`) SELECT `id`, `key`, `owner_id` FROM `keys`;--> statement-breakpoint
DROP TABLE `keys`;--> statement-breakpoint
ALTER TABLE `__new_keys` RENAME TO `keys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;