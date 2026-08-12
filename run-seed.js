const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env not found!');
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

loadEnv();
try {
  execSync('pnpm.cmd --filter @workspace/api-server run seed', { stdio: 'inherit' });
  console.log('Seeding completed successfully!');
} catch (e) {
  console.error('Seeding failed:', e.message);
  process.exit(1);
}
