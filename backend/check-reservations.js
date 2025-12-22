import { pool } from './db.js';

async function checkReservationTable() {
  try {
    console.log('Checking reservation table structure...');

    const [desc] = await pool.query('DESCRIBE reservation');
    console.log('Reservation table structure:', desc);
    
    const [reservations] = await pool.query('SELECT * FROM reservation ORDER BY id DESC LIMIT 5');
    console.log('\nRecent reservations:', reservations);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkReservationTable();
