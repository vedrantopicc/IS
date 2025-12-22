import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

async function addAdminUser() {
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

    const adminData = {
      username: "administrator123",
      name: "Administrator",
      surname: "Administratovic", 
      email: "administrator@gmail.com",
      password: "administrator123", 
      role: "Admin"
    };

    const [existingUser] = await connection.query(
      "SELECT id FROM `user` WHERE email = ? OR username = ? LIMIT 1",
      [adminData.email, adminData.username]
    );

    if (existingUser.length > 0) {
      console.log("❌ Admin user already exists!");
      return;
    }
    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    const [result] = await connection.query(
      "INSERT INTO `user` (username, name, surname, email, password, role) VALUES (?, ?, ?, ?, ?, ?)",
      [adminData.username, adminData.name, adminData.surname, adminData.email, hashedPassword, adminData.role]
    );

    console.log("✅ Admin user created successfully!");
    console.log(`Username: ${adminData.username}`);
    console.log(`Email: ${adminData.email}`);
    console.log(`Password: ${adminData.password}`);
    console.log(`Role: ${adminData.role}`);
    console.log(`Database ID: ${result.insertId}`);

  } catch (error) {
    console.error("❌ Error creating admin user:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}
addAdminUser();
