import mysql from 'mysql2/promise';

const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, // Nikada ne piši lozinku direktno ovdje!
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    multipleStatements: true
};

const sql = `
-- 1. User
CREATE TABLE IF NOT EXISTS \`user\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`username\` VARCHAR(100) NOT NULL UNIQUE,
  \`name\` VARCHAR(100) NOT NULL,
  \`surname\` VARCHAR(100) NOT NULL,
  \`email\` VARCHAR(255) NOT NULL UNIQUE,
  \`password\` VARCHAR(255) NOT NULL,
  \`role\` VARCHAR(50) NOT NULL DEFAULT 'Student',
  \`is_organizer\` BOOLEAN DEFAULT FALSE,
  \`deleted_at\` TIMESTAMP NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Token
CREATE TABLE IF NOT EXISTS \`token\` (
  \`id\` VARCHAR(36) PRIMARY KEY,
  \`user_id\` INT NOT NULL,
  \`valid\` BOOLEAN DEFAULT TRUE,
  \`expires_at\` DATETIME NOT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Password reset
CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\` INT NOT NULL,
  \`token\` VARCHAR(64) NOT NULL UNIQUE,
  \`expires_at\` DATETIME NOT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Event
CREATE TABLE IF NOT EXISTS \`event\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`title\` VARCHAR(255) NOT NULL,
  \`description\` TEXT,
  \`location\` VARCHAR(255),
  \`date_and_time\` DATETIME NOT NULL,
  \`image\` VARCHAR(500),
  \`user_id\` INT NOT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Ticket type
CREATE TABLE IF NOT EXISTS \`ticket_type\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`event_id\` INT NOT NULL,
  \`name\` VARCHAR(100) NOT NULL,
  \`price\` DECIMAL(10, 2) NOT NULL,
  \`total_seats\` INT NOT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (\`event_id\`) REFERENCES \`event\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Reservation
CREATE TABLE IF NOT EXISTS \`reservation\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\` INT NOT NULL,
  \`ticket_type_id\` INT NOT NULL,
  \`event_id\` INT NOT NULL,
  \`number_of_tickets\` INT NOT NULL,
  \`code\` VARCHAR(36) UNIQUE,
  \`reservation_date\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE,
  FOREIGN KEY (\`ticket_type_id\`) REFERENCES \`ticket_type\`(\`id\`) ON DELETE CASCADE,
  FOREIGN KEY (\`event_id\`) REFERENCES \`event\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Comments
CREATE TABLE IF NOT EXISTS \`comments\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`comment_text\` VARCHAR(1000) NOT NULL,
  \`user_id\` INT NOT NULL,
  \`event_id\` INT NOT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE,
  FOREIGN KEY (\`event_id\`) REFERENCES \`event\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 8. Role requests
CREATE TABLE IF NOT EXISTS \`role_requests\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\` INT NOT NULL,
  \`status\` VARCHAR(20) DEFAULT 'pending',
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB;
`;

async function init() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log("🚀 Povezan na Aiven!");
        
        await connection.query(sql);
        console.log("✅ Svih 8 tabela je uspješno kreirano!");
        
        await connection.end();
    } catch (err) {
        console.error("❌ Greška prilikom kreiranja tabela:", err);
    }
}

init();