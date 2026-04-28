import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/update-settings',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data.substring(0, 100)));
});

req.on('error', console.error);
req.write(JSON.stringify({ id: 'appConfig' }));
req.end();
