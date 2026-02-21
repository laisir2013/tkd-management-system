CREATE TABLE `elite_absence_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`lesson_number` int NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `elite_absence_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `elite_class_dates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lesson_number` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`day` int NOT NULL,
	`class_date` timestamp NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `elite_class_dates_id` PRIMARY KEY(`id`),
	CONSTRAINT `elite_class_dates_lesson_number_unique` UNIQUE(`lesson_number`)
);
--> statement-breakpoint
CREATE TABLE `elite_payment_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`period_number` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`payment_date` timestamp,
	`payment_method` varchar(50),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `elite_payment_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `elite_students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`phone` varchar(20),
	`start_date` varchar(50),
	`attend_count` int NOT NULL DEFAULT 0,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `elite_students_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `elite_absence_records` ADD CONSTRAINT `elite_absence_records_student_id_elite_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `elite_students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `elite_payment_records` ADD CONSTRAINT `elite_payment_records_student_id_elite_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `elite_students`(`id`) ON DELETE no action ON UPDATE no action;