import { exec } from 'child_process';

const child = exec('node server.ts');

child.stdout?.on('data', (data) => console.log('STDOUT:', data));
child.stderr?.on('data', (data) => console.log('STDERR:', data));

setTimeout(() => {
  child.kill();
  process.exit(0);
}, 3000);
