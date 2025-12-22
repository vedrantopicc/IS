import { getPool } from './db.js';
import bcrypt from 'bcrypt';

async function resetAdminPassword() {
  try {
    const db = getPool();
    
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    console.log('Updating admin password...');
    const [result] = await db.execute(
      'UPDATE user SET password = ? WHERE email = ? AND role = ?',
      [hashedPassword, 'administrator@gmail.com', 'Admin']
    );
    
    if (result.affectedRows > 0) {
      console.log('Admin password successfully updated to: admin123');
    } else {
      console.log('No admin user found to update');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetAdminPassword();
