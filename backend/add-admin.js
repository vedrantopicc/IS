import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

async function addAdminUser() {
  let connection;
  
  try {
    // Povezivanje na Aiven bazu podataka
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 18835), // Aiven port je obično 18835
      ssl: {
        rejectUnauthorized: false // OVO JE OBAVEZNO ZA AIVEN
      }
    });

    console.log("✅ Connected to Aiven database");

    const adminData = {
      username: "administrator123",
      name: "Glavni",
      surname: "Admin", 
      email: "admin@studlife.com",
      password: "administrator123", // Ova lozinka će biti hash-ovana
      role: "Admin",
      is_organizer: 1 // Dajemo adminu i prava organizatora
    };

    // Provjera da li admin već postoji u tabeli 'user'
    const [existingUser] = await connection.query(
      "SELECT id FROM `user` WHERE email = ? OR username = ? LIMIT 1",
      [adminData.email, adminData.username]
    );

    if (existingUser.length > 0) {
      console.log("❌ Admin user already exists in table 'user'!");
      return;
    }

    // Sigurno hash-ovanje lozinke
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminData.password, saltRounds);

    // Unos novog admina u bazu
    const [result] = await connection.query(
      "INSERT INTO `user` (username, name, surname, email, password, role, is_organizer) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        adminData.username, 
        adminData.name, 
        adminData.surname, 
        adminData.email, 
        hashedPassword, 
        adminData.role, 
        adminData.is_organizer
      ]
    );

    console.log("------------------------------------------");
    console.log("✅ Admin user created successfully!");
    console.log(`👤 Username: ${adminData.username}`);
    console.log(`📧 Email: ${adminData.email}`);
    console.log(`🔑 Password: ${adminData.password}`);
    console.log(`🛡️ Role: ${adminData.role}`);
    console.log(`🆔 Database ID: ${result.insertId}`);
    console.log("------------------------------------------");

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