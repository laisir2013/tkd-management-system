CREATE TABLE `elite_attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schedule_id` int NOT NULL,
	`student_id` int NOT NULL,
	`status` enum('present','absent','late','excused') NOT NULL DEFAULT 'present',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `elite_attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `elite_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`class_count` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`receipt_url` text,
	`receipt_key` text,
	`payment_date` timestamp NOT NULL,
	`confirmed_by` enum('parent_upload','admin_approved') DEFAULT 'admin_approved',
	`status` enum('pending','confirmed') NOT NULL DEFAULT 'confirmed',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `elite_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `elite_students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`phone` varchar(50) NOT NULL,
	`password` varchar(255),
	`belt_level` varchar(50),
	`schedule_day` varchar(50),
	`schedule_time` varchar(50),
	`fee_per_class` decimal(10,2) NOT NULL DEFAULT '0',
	`remaining_classes` int NOT NULL DEFAULT 0,
	`status` enum('active','inactive','suspended') NOT NULL DEFAULT 'active',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `elite_students_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `elite_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`training_date` timestamp NOT NULL,
	`schedule_day` varchar(50) NOT NULL,
	`schedule_time` varchar(50) NOT NULL,
	`status` enum('active','cancelled') NOT NULL DEFAULT 'active',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `elite_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `elite_payments` ADD CONSTRAINT `elite_payments_student_id_elite_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `elite_students`(`id`) ON DELETE no action ON UPDATE no action;