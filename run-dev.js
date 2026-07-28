const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const COLORS = {
  api: '\x1b[34m',       // Blue
  hrms: '\x1b[32m',      // Green
  portal: '\x1b[36m',    // Cyan
  system: '\x1b[35m',    // Magenta
  warning: '\x1b[33m',   // Yellow
  error: '\x1b[31m',     // Red
  reset: '\x1b[0m'
};

function log(service, message, type = 'info') {
  const color = COLORS[service] || COLORS.reset;
  const reset = COLORS.reset;
  const time = new Date().toLocaleTimeString();
  const prefix = `[${time}] [${service.toUpperCase()}]`;
  if (type === 'error') {
    console.error(`${color}${prefix} ${message}${reset}`);
  } else {
    console.log(`${color}${prefix} ${message}${reset}`);
  }
}

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    const examplePath = path.join(__dirname, '.env.example');
    if (fs.existsSync(examplePath)) {
      log('system', 'Creating .env file from .env.example...', 'warning');
      fs.copyFileSync(examplePath, envPath);
      log('system', 'Please open the .env file in your editor and update the DATABASE_URL connection string!', 'warning');
      log('system', 'Once updated, run this script again.', 'warning');
      process.exit(0);
    } else {
      log('system', '.env and .env.example not found!', 'error');
      process.exit(1);
    }
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

  if (!process.env.DATABASE_URL) {
    log('system', 'DATABASE_URL is not set in the .env file!', 'error');
    process.exit(1);
  }
}

function runCommand(command, description) {
  log('system', `${description}...`);
  try {
    execSync(command, { stdio: 'inherit', shell: true });
  } catch (error) {
    log('system', `Command failed: ${command}`, 'error');
    process.exit(1);
  }
}

function main() {
  loadEnv();

  console.log('==========================================================');
  console.log('  Red Fox Hotel HRMS - Local Development Launcher (Node)');
  console.log('==========================================================');
  console.log();

  // 1. Install dependencies
  runCommand('pnpm install', 'Checking and installing dependencies');
  runCommand('pnpm approve-builds --all', 'Approving builds');

  // 2. Push database schema
  runCommand('pnpm --filter @workspace/db run push', 'Pushing database schema (creating tables)');

  // 3. Seed database
  runCommand('pnpm --filter @workspace/api-server run seed', 'Seeding database with default accounts');

  // 4. Launch frontends and backends
  log('system', 'Launching backend and frontends...');

  const services = [
    {
      name: 'api',
      command: 'pnpm --filter @workspace/api-server run dev',
      env: { PORT: '8080' }
    },
    {
      name: 'hrms',
      command: 'pnpm --filter @workspace/hotel-hrms run dev',
      env: { PORT: '18896', BASE_PATH: '/' }
    },
    {
      name: 'portal',
      command: 'pnpm --filter @workspace/employee-portal run dev',
      env: { PORT: '25852', BASE_PATH: '/' }
    }
  ];

  services.forEach(service => {
    const child = spawn(service.command, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...service.env }
    });

    child.stdout.on('data', data => {
      data.toString().split(/\r?\n/).forEach(line => {
        if (line.trim()) {
          log(service.name, line.trim());
        }
      });
    });

    child.stderr.on('data', data => {
      data.toString().split(/\r?\n/).forEach(line => {
        if (line.trim()) {
          log(service.name, line.trim(), 'error');
        }
      });
    });

    child.on('close', code => {
      log(service.name, `Process exited with code ${code}`, code === 0 ? 'info' : 'error');
    });
  });

  console.log();
  console.log('==========================================================');
  console.log('  Launch Complete!');
  console.log();
  console.log(`  * HRMS Frontend:      http://localhost:18896/`);
  console.log(`  * Employee Portal:    http://localhost:25852/ (incorporates Attendance Kiosk)`);
  console.log(`  * API Server:         http://localhost:8080/api`);
  console.log('==========================================================');
  console.log();
}

main();
