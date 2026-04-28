import https from 'https';

const req = https.request({
  hostname: 'ais-pre-xgqimkpdj2zgdmne5ssqwk-260533840019.europe-west2.run.app',
  port: 443,
  path: '/api/update-settings',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Body:', data.substring(0, 200)));
});

req.on('error', console.error);
req.write(JSON.stringify({ id: 'appConfig' }));
req.end();
