PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_keys` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL UNIQUE,
	`owner_id` text NOT NULL,
	`isAdmin` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_keys_owner_id_groups_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `groups`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_keys`(`id`, `key`, `owner_id`, `isAdmin`) SELECT `id`, `key`, `owner_id`, `isAdmin` FROM `keys`;--> statement-breakpoint
DROP TABLE `keys`;--> statement-breakpoint
ALTER TABLE `__new_keys` RENAME TO `keys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;