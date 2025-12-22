import { getPool } from './db.js';

async function checkAdmin() {
  try {
    const db = getPool();
    
    console.log('Checking for admin users...');
    const [users] = await db.execute(
      'SELECT id, email, role, password FROM user WHERE role = ?',
      ['admin']
    );
    
    console.log('Admin users found:');
    users.forEach(user => {
      console.log(`ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, Password starts with: ${user.password.substring(0, 10)}...`);
    });
    
    if (users.length === 0) {
      console.log('No admin users found!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAdmin();
