const testBackendConnection = async () => {
  try {
    const response = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'administrator@gmail.com',
        password: 'admin123'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Backend connection successful!');
      console.log('Login response:', data);
    } else {
      console.log('Backend responded with error:', response.status);
      const errorData = await response.json();
      console.log('Error data:', errorData);
    }
  } catch (error) {
    console.error('Failed to connect to backend:', error);
  }
};

testBackendConnection();
