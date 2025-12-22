import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function testEventsQuery() {
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

    const [tableCheck] = await connection.query("SHOW TABLES LIKE 'event'");
    console.log("Event table exists:", tableCheck.length > 0);

    if (tableCheck.length > 0) {
      const [count] = await connection.query("SELECT COUNT(*) as count FROM event");
      console.log("Total events in database:", count[0].count);

      const [events] = await connection.query("SELECT id, title, date_and_time FROM event LIMIT 5");
      console.log("Sample events:", events);
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

testEventsQuery();
