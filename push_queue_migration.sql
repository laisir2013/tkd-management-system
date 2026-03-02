-- ════════════════════════════════════════════════════════════════════════
-- Push Queue Table Migration
-- 推播審核佇列表：所有自動推播先進入佇列，等管理員批准後才實際發送
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  target_type ENUM('individual', 'role', 'all', 'class', 'coach_students') NOT NULL DEFAULT 'individual',
  target_student_ids JSON DEFAULT NULL COMMENT 'Array of {id, type, name} for individual targets',
  student_type ENUM('regular', 'elite', 'both') DEFAULT 'regular',
  trigger_source VARCHAR(100) NOT NULL COMMENT 'e.g. elite_class_progress, payment_confirmed, new_event, etc.',
  trigger_detail JSON DEFAULT NULL COMMENT 'Context data from the triggering action',
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR(50) DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  reject_reason TEXT DEFAULT NULL,
  sent_count INT DEFAULT 0 COMMENT 'Number of devices actually sent to after approval',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_push_queue_status (status),
  INDEX idx_push_queue_created_at (created_at),
  INDEX idx_push_queue_trigger_source (trigger_source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
