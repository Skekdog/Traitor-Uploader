PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_assets` (
	`id` text PRIMARY KEY,
	`roblox_id` text NOT NULL UNIQUE,
	`key` text NOT NULL,
	CONSTRAINT `fk_assets_key_keys_key_fk` FOREIGN KEY (`key`) REFERENCES `keys`(`key`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_assets`(`id`, `roblox_id`, `key`) SELECT `id`, `roblox_id`, `key` FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;