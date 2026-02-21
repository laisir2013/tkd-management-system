CREATE TABLE `paymentRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`paymentPeriod` enum('Q1','Q2','Q3','Q4','CUSTOM') NOT NULL,
	`customMonths` json,
	`amount` decimal(10,2) NOT NULL,
	`receiptUrl` text,
	`receiptKey` text,
	`paymentDate` timestamp NOT NULL,
	`status` enum('pending','confirmed') NOT NULL DEFAULT 'confirmed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymentRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`birthDate` timestamp,
	`phone` varchar(50) NOT NULL,
	`venue` varchar(100) NOT NULL,
	`scheduleDay` varchar(50),
	`scheduleTime` varchar(50),
	`feePerQuarter` decimal(10,2) NOT NULL,
	`beltLevel` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `students_id` PRIMARY KEY(`id`)
);
