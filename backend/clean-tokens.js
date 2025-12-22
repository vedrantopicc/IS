import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

async function cleanTokens() {
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

    const [tokenCols] = await connection.query("DESCRIBE token");
    console.log("Token table columns:", tokenCols.map(col => `${col.Field} (${col.Type})`));

    const [result] = await connection.query("DELETE FROM token WHERE user_id = 21");
    console.log("✅ Deleted", result.affectedRows, "old tokens for admin user");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

cleanTokens();
