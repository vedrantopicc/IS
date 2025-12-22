import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

async function testUserQuery() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
    });

    console.log("✅ Connected to database");

    const [columns] = await connection.query("DESCRIBE user");
    console.log("User table columns:", columns.map(col => col.Field));

    const [users] = await connection.query(`
      SELECT 
        id, username, name, surname, email, role
      FROM user 
      ORDER BY id DESC
    `);
    console.log("Users query successful, returned:", users.length, "users");

    const [userCounts] = await connection.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'Student' THEN 1 ELSE 0 END) as total_students,
        SUM(CASE WHEN role = 'Organizer' THEN 1 ELSE 0 END) as total_organizers,
        SUM(CASE WHEN role = 'Admin' THEN 1 ELSE 0 END) as total_admins
      FROM user
    `);
    console.log("Dashboard query successful:", userCounts[0]);

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

testUserQuery();
