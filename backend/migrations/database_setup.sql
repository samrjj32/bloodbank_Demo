-- Drop existing tables if they exist
DROP TABLE IF EXISTS donations;
DROP TABLE IF EXISTS blood_requests;
DROP TABLE IF EXISTS donor_profiles;
DROP TABLE IF EXISTS requester_profiles;
DROP TABLE IF EXISTS users;

-- Create users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('donor', 'requester', 'admin') NOT NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    location VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create donor_profiles table
CREATE TABLE donor_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    blood_type ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    is_available BOOLEAN DEFAULT true,
    last_donation_date DATETIME,
    medical_conditions TEXT,
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create requester_profiles table
CREATE TABLE requester_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    organization_name VARCHAR(255),
    organization_type ENUM('hospital', 'blood_bank', 'clinic', 'individual') NOT NULL,
    license_number VARCHAR(50),
    verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create blood_requests table
CREATE TABLE blood_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    requester_id INT NOT NULL,
    blood_type ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    units INT NOT NULL,
    urgency ENUM('normal', 'urgent', 'emergency') DEFAULT 'normal',
    status ENUM('pending', 'approved', 'completed', 'cancelled') DEFAULT 'pending',
    location VARCHAR(255) NOT NULL,
    required_by_date DATE,
    patient_age INT,
    patient_gender ENUM('male', 'female', 'other'),
    medical_condition TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create donations table
CREATE TABLE donations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    donor_id INT NOT NULL,
    request_id INT NOT NULL,
    donation_date DATETIME NOT NULL,
    status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
    donation_center VARCHAR(255),
    hemoglobin_level DECIMAL(4,2),
    blood_pressure VARCHAR(20),
    pulse_rate INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE
);

-- Create notifications table
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('request_match', 'donation_reminder', 'status_update', 'general') NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_location ON users(location);
CREATE INDEX idx_donor_profiles_blood_type ON donor_profiles(blood_type);
CREATE INDEX idx_donor_profiles_is_available ON donor_profiles(is_available);
CREATE INDEX idx_requester_profiles_verification ON requester_profiles(verification_status);
CREATE INDEX idx_blood_requests_blood_type ON blood_requests(blood_type);
CREATE INDEX idx_blood_requests_status ON blood_requests(status);
CREATE INDEX idx_blood_requests_urgency ON blood_requests(urgency);
CREATE INDEX idx_blood_requests_location ON blood_requests(location);
CREATE INDEX idx_donations_donation_date ON donations(donation_date);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Insert default admin user (password: admin123)
INSERT INTO users (name, email, password, role, location, phone) VALUES 
('Admin', 'admin@bloodbank.com', '$2a$10$VtV0XbqOZ.tZKxK3q.zKz.YGT3tHYKVBpVJ5q.vqU3qVdNP3.vvwS', 'admin', 'System', '+1234567890');

-- Create blood compatibility view
CREATE OR REPLACE VIEW blood_compatibility AS
SELECT 
    recipient_blood_type,
    GROUP_CONCAT(donor_blood_type) as compatible_donors
FROM (
    SELECT 'A+' as recipient_blood_type, 'A+' as donor_blood_type UNION
    SELECT 'A+', 'A-' UNION SELECT 'A+', 'O+' UNION SELECT 'A+', 'O-' UNION
    SELECT 'A-', 'A-' UNION SELECT 'A-', 'O-' UNION
    SELECT 'B+', 'B+' UNION SELECT 'B+', 'B-' UNION SELECT 'B+', 'O+' UNION SELECT 'B+', 'O-' UNION
    SELECT 'B-', 'B-' UNION SELECT 'B-', 'O-' UNION
    SELECT 'AB+', 'A+' UNION SELECT 'AB+', 'A-' UNION SELECT 'AB+', 'B+' UNION SELECT 'AB+', 'B-' UNION
    SELECT 'AB+', 'AB+' UNION SELECT 'AB+', 'AB-' UNION SELECT 'AB+', 'O+' UNION SELECT 'AB+', 'O-' UNION
    SELECT 'AB-', 'A-' UNION SELECT 'AB-', 'B-' UNION SELECT 'AB-', 'AB-' UNION SELECT 'AB-', 'O-' UNION
    SELECT 'O+', 'O+' UNION SELECT 'O+', 'O-' UNION
    SELECT 'O-', 'O-'
) as blood_rules
GROUP BY recipient_blood_type;

-- Create view for available donors
CREATE OR REPLACE VIEW available_donors AS
SELECT 
    u.id,
    u.name,
    u.location,
    u.phone,
    dp.blood_type,
    dp.last_donation_date
FROM users u
JOIN donor_profiles dp ON u.id = dp.user_id
WHERE u.role = 'donor' 
AND u.status = 'active'
AND dp.is_available = true
AND (dp.last_donation_date IS NULL OR dp.last_donation_date <= DATE_SUB(CURRENT_DATE, INTERVAL 3 MONTH)); 