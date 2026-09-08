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
    // Ovo ispod je samo za tvoju provjeru u konzoli
    console.log("🚀 Creating database pool for Aiven...");
    
    const useSsl = process.env.DB_SSL !== "false";
    const config = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 3306),
      waitForConnections: true,
      connectionLimit: 10,
    };

    if (useSsl) {
      config.ssl = {
        rejectUnauthorized: false
      };
    }

    _pool = mysql.createPool(config);
  }
  return _pool;
};

export const closePool = async () => {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
};

export const pool = new Proxy({}, {
  get(target, prop) {
    const p = getPool();
    const value = p[prop];
    if (typeof value === 'function') {
      return value.bind(p);
    }
    return value;
  }
});
