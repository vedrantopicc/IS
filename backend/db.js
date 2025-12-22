import mysql from "mysql2/promise";
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

let _pool = null;

export const getPool = () => {
  if (!_pool) {
    console.log("Creating database pool with config:", {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
    });
    
    _pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return _pool;
};

export const pool = new Proxy({}, {
  get(target, prop) {
    return getPool()[prop];
  }
});