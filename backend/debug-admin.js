import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

async function testQueries() {
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

    console.log("\n1. Testing dashboard user counts query...");
    const [userCounts] = await connection.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'Student' THEN 1 ELSE 0 END) as total_students,
        SUM(CASE WHEN role = 'Organizer' THEN 1 ELSE 0 END) as total_organizers,
        SUM(CASE WHEN role = 'Admin' THEN 1 ELSE 0 END) as total_admins
      FROM user
    `);
    console.log("✅ User counts query success:", userCounts[0]);

    console.log("\n2. Testing dashboard event counts query...");
    const [eventCounts] = await connection.query(`
      SELECT 
        COUNT(*) as total_events,
        SUM(CASE WHEN date_and_time > NOW() THEN 1 ELSE 0 END) as upcoming_events,
        SUM(CASE WHEN date_and_time <= NOW() THEN 1 ELSE 0 END) as past_events
      FROM event
    `);
    console.log("✅ Event counts query success:", eventCounts[0]);

    console.log("\n3. Testing admin users query...");
    const [users] = await connection.query(`
      SELECT 
        id, username, name, surname, email, role
      FROM user 
      ORDER BY id DESC
    `);
    console.log("✅ Users query success, returned:", users.length, "users");

    console.log("\n4. Testing admin events query...");
    const [events] = await connection.query(`
      SELECT 
        e.id,
        e.title,
        e.date_and_time,
        e.number_of_available_seats,
        e.price,
        e.image,
        e.description,
        e.user_id,
        CONCAT_WS(' ', u.name, u.surname) AS organizer_name,
        u.username AS organizer_username,
        u.email AS organizer_email
      FROM event e
      JOIN \`user\` u ON u.id = e.user_id
      ORDER BY e.date_and_time DESC
    `);
    console.log("✅ Events query success, returned:", events.length, "events");

    console.log("\n🎉 All queries successful!");

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Full error:", error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

testQueries();
