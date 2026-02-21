CREATE TABLE `attendance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`student_id` int NOT NULL,
	`attendance_date` timestamp NOT NULL,
	`status` enum('present','absent','late','excused') NOT NULL DEFAULT 'present',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `belt_levels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`color` varchar(20) NOT NULL,
	`order` int NOT NULL,
	`minimum_training_days` int NOT NULL DEFAULT 90,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `belt_levels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coaches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`belt_level_id` int,
	`base_salary` int NOT NULL DEFAULT 0,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`join_date` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coaches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`dojo_id` int,
	`coach_id` int,
	`day_of_week` enum('monday','tuesday','wednesday','thursday','friday','saturday','sunday') NOT NULL,
	`start_time` varchar(5) NOT NULL,
	`end_time` varchar(5) NOT NULL,
	`max_students` int DEFAULT 20,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dojos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`address` text,
	`phone` varchar(20),
	`email` varchar(320),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dojos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_belt_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`student_id` int NOT NULL,
	`from_belt_level_id` int,
	`to_belt_level_id` int NOT NULL,
	`promotion_date` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `student_belt_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `students` ADD `student_number` varchar(50);--> statement-breakpoint
ALTER TABLE `students` ADD `gender` enum('male','female','other');--> statement-breakpoint
ALTER TABLE `students` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `students` ADD `address` text;--> statement-breakpoint
ALTER TABLE `students` ADD `emergency_contact` varchar(100);--> statement-breakpoint
ALTER TABLE `students` ADD `emergency_phone` varchar(20);--> statement-breakpoint
ALTER TABLE `students` ADD `dojo_id` int;--> statement-breakpoint
ALTER TABLE `students` ADD `coach_id` int;--> statement-breakpoint
ALTER TABLE `students` ADD `current_belt_level_id` int;--> statement-breakpoint
ALTER TABLE `students` ADD `status` enum('active','inactive','suspended') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `join_date` timestamp;--> statement-breakpoint
ALTER TABLE `students` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_student_number_unique` UNIQUE(`student_number`);--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coaches` ADD CONSTRAINT `coaches_belt_level_id_belt_levels_id_fk` FOREIGN KEY (`belt_level_id`) REFERENCES `belt_levels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_dojo_id_dojos_id_fk` FOREIGN KEY (`dojo_id`) REFERENCES `dojos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_coach_id_coaches_id_fk` FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_belt_history` ADD CONSTRAINT `student_belt_history_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_belt_history` ADD CONSTRAINT `student_belt_history_from_belt_level_id_belt_levels_id_fk` FOREIGN KEY (`from_belt_level_id`) REFERENCES `belt_levels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_belt_history` ADD CONSTRAINT `student_belt_history_to_belt_level_id_belt_levels_id_fk` FOREIGN KEY (`to_belt_level_id`) REFERENCES `belt_levels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_dojo_id_dojos_id_fk` FOREIGN KEY (`dojo_id`) REFERENCES `dojos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_coach_id_coaches_id_fk` FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_current_belt_level_id_belt_levels_id_fk` FOREIGN KEY (`current_belt_level_id`) REFERENCES `belt_levels`(`id`) ON DELETE no action ON UPDATE no action;