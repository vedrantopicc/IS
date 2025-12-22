import { pool } from "./db.js";

async function createCommentsTable() {
  try {
    console.log("Checking existing tables...");
    const [tables] = await pool.execute("SHOW TABLES");
    console.log("Existing tables:", tables);

    console.log("\nCreating comments table...");
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id INT NOT NULL,
        user_id INT NOT NULL,
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_event_id (event_id),
        INDEX idx_user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
      )
    `;

    await pool.execute(createTableSQL);
    console.log("Comments table created successfully!");

    console.log("\nChecking tables after creation...");
    const [newTables] = await pool.execute("SHOW TABLES");
    console.log("Tables after creation:", newTables);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

createCommentsTable();
