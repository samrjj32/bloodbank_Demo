-- Modify urgency column to use ENUM
ALTER TABLE blood_requests MODIFY COLUMN urgency ENUM('normal', 'urgent', 'emergency') NOT NULL DEFAULT 'normal'; 