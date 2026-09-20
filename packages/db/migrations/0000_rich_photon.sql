CREATE TABLE `epochs` (
	`index` integer PRIMARY KEY NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`start_slot` integer,
	`end_slot` integer,
	`pinned_prices` text,
	`methodology_url` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `epochs_status_idx` ON `epochs` (`status`);--> statement-breakpoint
CREATE TABLE `evidence_bundles` (
	`epoch_index` integer PRIMARY KEY NOT NULL,
	`market_slug` text NOT NULL,
	`start_slot` integer NOT NULL,
	`end_slot` integer NOT NULL,
	`total_usd_base_units` text NOT NULL,
	`threshold_base_units` text NOT NULL,
	`outcome` text NOT NULL,
	`transaction_count` integer NOT NULL,
	`methodology` text NOT NULL,
	`signatures` text NOT NULL,
	`published_url` text,
	`computed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`epoch_index`) REFERENCES `epochs`(`index`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`market_slug`) REFERENCES `markets`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `heartbeats` (
	`id` text PRIMARY KEY NOT NULL,
	`beat_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `liquidation_events` (
	`signature` text NOT NULL,
	`instruction_index` integer NOT NULL,
	`slot` integer NOT NULL,
	`block_time` integer,
	`protocol` text NOT NULL,
	`collateral_mint` text NOT NULL,
	`collateral_amount` text NOT NULL,
	`usd_base_units` text,
	`indexed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`signature`, `instruction_index`)
);
--> statement-breakpoint
CREATE INDEX `liq_protocol_slot_idx` ON `liquidation_events` (`protocol`,`slot`);--> statement-breakpoint
CREATE TABLE `markets` (
	`slug` text PRIMARY KEY NOT NULL,
	`epoch_index` integer NOT NULL,
	`protocol` text NOT NULL,
	`risk_class` text NOT NULL,
	`threshold_base_units` text NOT NULL,
	`panta_market_id` text,
	`panta_market_url` text,
	`creation_signature` text,
	`seeded_base_units` text,
	`seed_signature` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`epoch_index`) REFERENCES `epochs`(`index`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `markets_epoch_protocol_class_idx` ON `markets` (`epoch_index`,`protocol`,`risk_class`);--> statement-breakpoint
CREATE INDEX `markets_epoch_idx` ON `markets` (`epoch_index`);--> statement-breakpoint
CREATE TABLE `trades` (
	`signature` text PRIMARY KEY NOT NULL,
	`market_slug` text NOT NULL,
	`wallet` text NOT NULL,
	`side` text NOT NULL,
	`amount_base_units` text NOT NULL,
	`panta_confirmed` integer DEFAULT false NOT NULL,
	`is_seed` integer DEFAULT false NOT NULL,
	`reported_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`market_slug`) REFERENCES `markets`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trades_market_idx` ON `trades` (`market_slug`);--> statement-breakpoint
CREATE INDEX `trades_wallet_idx` ON `trades` (`wallet`);