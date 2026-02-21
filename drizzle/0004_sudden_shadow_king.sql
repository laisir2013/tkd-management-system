CREATE TABLE IF NOT EXISTS `payment_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`reminded_at` timestamp NOT NULL DEFAULT (now()),
	`reminded_by` int NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `training_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`training_date` timestamp NOT NULL,
	`venue` varchar(100) NOT NULL,
	`schedule_day` varchar(50) NOT NULL,
	`schedule_time` varchar(50) NOT NULL,
	`status` enum('active','cancelled') NOT NULL DEFAULT 'active',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `training_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','coach') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `students` ADD COLUMN IF NOT EXISTS `password` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `password` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `coach_name` varchar(100);--> statement-breakpoint
ALTER TABLE `payment_reminders` ADD CONSTRAINT `payment_reminders_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_reminders` ADD CONSTRAINT `payment_reminders_reminded_by_users_id_fk` FOREIGN KEY (`reminded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
