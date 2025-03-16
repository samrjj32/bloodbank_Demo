-- Drop the table if it exists and recreate with proper structure
DROP TABLE IF EXISTS donor_profiles;

CREATE TABLE donor_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    blood_type ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    phone VARCHAR(20),
    location VARCHAR(255),
    is_available BOOLEAN DEFAULT true,
    last_donation_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
); 