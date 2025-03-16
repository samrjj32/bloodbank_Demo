# Blood Bank Web App - Detailed Flow & Features

## **Overview**

The Blood Bank Web App is designed to facilitate blood donation and requests by connecting donors with individuals in need. The system includes user authentication, donor registration, blood request management, and an admin panel for oversight.

### **Technology Stack:**

- **Frontend:** React.js (SPA with API calls)
- **Backend:** Node.js with Express.js
- **Database:** MySQL (Using MAMP for local development)
- **Authentication:**  normal auth

## **Database Setup (MAMP MySQL)**

### **1. Start MySQL in MAMP**

1. Open **MAMP** and start the **Apache & MySQL** servers.
2. Click **Open WebStart page**, then navigate to **phpMyAdmin**.
3. Create a new database, e.g., `blood_bank_db`.

### **2. Configure MySQL Connection in Node.js**

Inside your **backend/config/db.js**, configure MySQL connection:

```js
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',  // Default MAMP MySQL user
  password: 'root',  // Default MAMP MySQL password
  database: 'blood_bank_db', // Your database name
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

module.exports = db;
```

### **3. Run Migrations (Create Tables)**

Use this **schema.sql** file to create the required tables:

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('donor', 'requester', 'admin') NOT NULL
);

CREATE TABLE donors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  blood_type VARCHAR(5) NOT NULL,
  location VARCHAR(255) NOT NULL,
  contact_info VARCHAR(255),
  availability BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  blood_type VARCHAR(5) NOT NULL,
  location VARCHAR(255) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

1. Open **phpMyAdmin**.
2. Select your database (`blood_bank_db`).
3. Open the **SQL tab**, paste the above script, and click **Execute**.

---

## **Project Structure**

```
blood-bank-app/
│── backend/              # Node.js backend
│   ├── config/           # Database & environment configurations
│   ├── controllers/      # API logic
│   ├── models/          # Database schemas (User, Donor, Request, etc.)
│   ├── routes/          # API routes
│   ├── middleware/       # Authentication & error handling
│   ├── server.js        # Main server file
│   ├── package.json     # Backend dependencies
│
│── frontend/             # React.js frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Page components (Login, Register, Dashboard, etc.)
│   │   ├── services/     # API interactions
│   │   ├── context/      # Context API for state management
│   │   ├── App.js        # Root React component
│   │   ├── index.js      # Entry point
│   ├── package.json      # Frontend dependencies
│
│── database/             # SQL scripts
│   ├── schema.sql        # Table creation script
│   ├── seed.sql          # Sample data
│
│── .gitignore
│── README.md
```

---

## **Website Flow & Features**

### **1. User Authentication**

**Actors:** Donor, Requester, Admin

- **Registration**

  - New users can register by providing name, email, password, and role (Donor/Requester).
  - Passwords are hashed before storing in the `users` table.

- **Login**

  - Users log in with email and password.
  - Backend validates credentials and issues a JWT token.
  - The frontend stores the token and uses it for authenticated requests.

- **Logout**

  - Token is removed from local storage.
  - User is redirected to the login page.

**API Endpoints:**

```
POST /auth/register   # User registration
POST /auth/login      # User login
POST /auth/logout     # User logout
```

---

### **2. Donor Registration & Management**

**Actors:** Donor

- A logged-in user can **register as a blood donor** by providing:

  - Blood Group
  - Location
  - Contact Information
  - Availability Status (Available/Unavailable)

- Donors can **update availability status** anytime.

- A list of **available donors** is visible to requesters.

**API Endpoints:**

```
POST /donors/register  # Register as a donor
GET  /donors           # Fetch available donors
PUT  /donors/:id       # Update donor status
```

### **3. Blood Request Management**

**Actors:** Requester, Admin

- **Create Blood Request**
  - Requesters can submit new blood requests
  - Required information: blood type, location, urgency level
  - System notifies nearby matching donors

- **Request Status**
  - Pending (default)
  - Approved (when donor accepts)
  - Rejected (if no donors available/found)

- **Admin Review**
  - Admins can review and manage all requests
  - Ability to prioritize urgent cases
  - Can contact donors directly if needed

**API Endpoints:**
```
POST /requests/new     # Create new request
GET  /requests         # List all requests (admin)
GET  /requests/user    # User's requests
PUT  /requests/:id     # Update request status
```

### **4. Admin Dashboard**

**Actors:** Admin

- **User Management**
  - View all users
  - Activate/deactivate accounts
  - Handle user reports/issues

- **Statistics & Reports**
  - Blood type availability
  - Request success rates
  - Geographic distribution of donors

- **System Settings**
  - Configure notification settings
  - Manage blood type compatibility rules
  - Set request timeout periods

**API Endpoints:**
```
GET  /admin/users      # List all users
GET  /admin/stats      # System statistics
PUT  /admin/settings   # Update system settings
```

### **5. Security & Performance**

- **Security Measures**
  - JWT token-based authentication
  - Password hashing using bcrypt
  - Input validation & sanitization
  - Rate limiting on API endpoints

- **Performance Optimization**
  - Database indexing
  - Caching frequently accessed data
  - Pagination for large data sets
  - Optimized API response formats

### **6. Additional Features**

- **Notifications**
  - Email alerts for request matches
  - SMS notifications (optional)
  - In-app notifications

- **Search & Filter**
  - Advanced donor search
  - Filter by blood type, location
  - Sort by availability, distance

- **User Profiles**
  - Donation history
  - Request history
  - Profile verification badges

This document serves as a structured guide for developers working on the Blood Bank Web App. 🚀
