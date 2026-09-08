import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "../../..");
const envTestPath = path.join(backendDir, ".env.test");

export function loadTestEnv() {
  if (!fs.existsSync(envTestPath)) {
    throw new Error(
      "Nedostaje backend/.env.test. Kopiraj backend/.env.test.example u backend/.env.test i upisi podatke za PRAZNU testnu bazu."
    );
  }

  dotenv.config({ path: envTestPath, override: true });

  if (!String(process.env.DB_NAME || "").toLowerCase().includes("test")) {
    throw new Error(
      "Integracioni testovi odbijaju rad jer DB_NAME ne sadrzi rijec 'test'. Koristi posebnu bazu, npr. studlife_test."
    );
  }

  process.env.NODE_ENV = "test";
}

loadTestEnv();

export const ids = {
  admin: 1,
  organizer: 2,
  student: 3,
  secondStudent: 4,
  category: 1,
  event: 1,
  draftEvent: 2,
  standardTicket: 1,
  vipTicket: 2,
  studentReservation: 1,
  studentComment: 1,
  notification: 1,
  pendingRoleRequest: 1,
};

const schemaSql = `
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notification;
DROP TABLE IF EXISTS user_activity;
DROP TABLE IF EXISTS role_requests;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS reservation;
DROP TABLE IF EXISTS ticket_type;
DROP TABLE IF EXISTS event_image;
DROP TABLE IF EXISTS event;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS token;
DROP TABLE IF EXISTS \`user\`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE \`user\` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  surname VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'Student',
  is_organizer BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE token (
  id VARCHAR(36) PRIMARY KEY,
  user_id INT NOT NULL,
  valid BOOLEAN DEFAULT TRUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES \`user\`(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES \`user\`(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE category (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE event (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  date_and_time DATETIME NOT NULL,
  image VARCHAR(500),
  user_id INT NOT NULL,
  category_id INT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES \`user\`(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE event_image (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  image_path VARCHAR(500) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE ticket_type (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  total_seats INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE reservation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  ticket_type_id INT NOT NULL,
  event_id INT NOT NULL,
  number_of_tickets INT NOT NULL,
  code VARCHAR(36) UNIQUE,
  reservation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_ticket (user_id, ticket_type_id),
  FOREIGN KEY (user_id) REFERENCES \`user\`(id) ON DELETE CASCADE,
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_type(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comment_text VARCHAR(1000) NOT NULL,
  rating INT NOT NULL,
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_event_review (user_id, event_id),
  FOREIGN KEY (user_id) REFERENCES \`user\`(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE role_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  reviewed_by INT NULL,
  FOREIGN KEY (user_id) REFERENCES \`user\`(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES \`user\`(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE notification (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  event_id INT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES \`user\`(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES \`user\`(id) ON DELETE CASCADE
) ENGINE=InnoDB;
`;

export async function getTestConnection() {
  const useSsl = process.env.DB_SSL !== "false";
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}

export async function resetTestDatabase() {
  const connection = await getTestConnection();
  try {
    await connection.query(schemaSql);
    await seedTestDatabase(connection);
  } finally {
    await connection.end();
  }
}

async function seedTestDatabase(connection) {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  await connection.query(
    `INSERT INTO \`user\`
      (id, username, name, surname, email, password, role, is_organizer)
     VALUES
      (1, 'admin', 'Admin', 'User', 'admin@test.local', ?, 'Admin', 0),
      (2, 'organizer', 'Olga', 'Organizer', 'organizer@test.local', ?, 'Student', 1),
      (3, 'student', 'Sara', 'Student', 'student@test.local', ?, 'Student', 0),
      (4, 'student2', 'Marko', 'Student', 'student2@test.local', ?, 'Student', 0)`,
    [passwordHash, passwordHash, passwordHash, passwordHash]
  );

  await connection.query(
    `INSERT INTO category (id, name)
     VALUES (1, 'edukativni'), (2, 'sportski'), (3, 'zabavni')`
  );

  await connection.query(
    `INSERT INTO event
      (id, title, description, location, date_and_time, image, user_id, category_id, status)
     VALUES
      (1, 'Node.js radionica', 'Prakticna radionica', 'Amfiteatar 1', '2030-06-01 18:00:00', '/uploads/node.jpg', 2, 1, 'PUBLISHED'),
      (2, 'Draft dogadjaj', 'Nije objavljen', 'Sala 2', '2030-07-01 18:00:00', NULL, 2, 1, 'DRAFT')`
  );

  await connection.query(
    `INSERT INTO event_image (id, event_id, image_path, is_primary, display_order)
     VALUES (1, 1, '/uploads/node.jpg', 1, 0)`
  );

  await connection.query(
    `INSERT INTO ticket_type (id, event_id, name, price, total_seats)
     VALUES
      (1, 1, 'Standard', 10.00, 2),
      (2, 1, 'VIP', 25.00, 1)`
  );

  await connection.query(
    `INSERT INTO reservation
      (id, user_id, event_id, ticket_type_id, number_of_tickets, code)
     VALUES (1, 3, 1, 1, 1, 'existing-reservation-code')`
  );

  await connection.query(
    `INSERT INTO comments
      (id, user_id, event_id, comment_text, rating)
     VALUES (1, 3, 1, 'Odlicna radionica', 5)`
  );

  await connection.query(
    `INSERT INTO notification
      (id, user_id, title, message, event_id, is_read)
     VALUES (1, 3, 'Podsjetnik', 'Radionica uskoro pocinje', 1, 0)`
  );

  await connection.query(
    `INSERT INTO role_requests (id, user_id, status)
     VALUES (1, 4, 'pending')`
  );
}
