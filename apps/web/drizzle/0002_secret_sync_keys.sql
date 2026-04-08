DROP INDEX IF EXISTS `kobo_tokens_token_unique`;
--> statement-breakpoint
ALTER TABLE `kobo_tokens` RENAME COLUMN `token` TO `token_hash`;
--> statement-breakpoint
ALTER TABLE `kobo_tokens` ADD COLUMN `token_preview` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `kobo_tokens`
SET `token_preview` = substr(`token_hash`, 1, 4) ||
	replace(hex(zeroblob(max(length(`token_hash`) - 4, 0))), '00', '*');
--> statement-breakpoint
CREATE UNIQUE INDEX `kobo_tokens_token_hash_unique` ON `kobo_tokens` (`token_hash`);
--> statement-breakpoint
DROP INDEX IF EXISTS `opds_keys_api_key_unique`;
--> statement-breakpoint
ALTER TABLE `opds_keys` RENAME COLUMN `api_key` TO `api_key_hash`;
--> statement-breakpoint
ALTER TABLE `opds_keys` ADD COLUMN `api_key_preview` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `opds_keys`
SET `api_key_preview` = substr(`api_key_hash`, 1, 4) ||
	replace(hex(zeroblob(max(length(`api_key_hash`) - 4, 0))), '00', '*');
--> statement-breakpoint
CREATE UNIQUE INDEX `opds_keys_api_key_hash_unique` ON `opds_keys` (`api_key_hash`);
