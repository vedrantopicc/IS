import fetch from 'node-fetch';

async function testAdminAPI() {
  try {
    console.log("1. Logging in as admin...");
    const loginRes = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'administrator@gmail.com',
        password: 'administrator123'
      })
    });
    
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginData.error}`);
    }
    
    console.log("✅ Login successful, got token");
    const token = loginData.token;

    console.log("\n2. Testing admin dashboard...");
    const dashboardRes = await fetch('http://localhost:3000/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const dashboardData = await dashboardRes.json();
    if (!dashboardRes.ok) {
      throw new Error(`Dashboard failed: ${dashboardData.error}`);
    }
    
    console.log("✅ Dashboard successful:", dashboardData);

    console.log("\n3. Testing admin users...");
    const usersRes = await fetch('http://localhost:3000/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const usersData = await usersRes.json();
    if (!usersRes.ok) {
      throw new Error(`Users failed: ${usersData.error}`);
    }
    
    console.log("✅ Users successful, count:", usersData.length);

    console.log("\n4. Testing admin events...");
    const eventsRes = await fetch('http://localhost:3000/admin/events', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const eventsData = await eventsRes.json();
    if (!eventsRes.ok) {
      throw new Error(`Events failed: ${eventsData.error}`);
    }
    
    console.log("✅ Events successful, count:", eventsData.length);
    
    console.log("\n🎉 All API calls successful!");

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testAdminAPI();
