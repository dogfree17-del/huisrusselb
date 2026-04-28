import https from 'https';

const req = https.request({
  hostname: 'ais-dev-xgqimkpdj2zgdmne5ssqwk-260533840019.europe-west2.run.app',
  port: 443,
  path: '/api/update-settings',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
});

req.on('error', console.error);
req.write(JSON.stringify({ id: 'appConfig' }));
req.end();
