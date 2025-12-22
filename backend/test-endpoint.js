import fetch from 'node-fetch';

async function testAdminEndpoint() {
  try {
    const response = await fetch('http://localhost:3000/admin/dashboard');
    const data = await response.text();
    
    console.log('Status:', response.status);
    console.log('Response:', data);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAdminEndpoint();
