const { execSync } = require('child_process');

function main() {
  const isWindows = process.platform === 'win32';
  const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';

  if (process.env.VERCEL) {
    console.log('==========================================================');
    console.log('  Vercel Build Router - Deploying Frontends');
    console.log('==========================================================');
    try {
      execSync(`${pnpm} --filter @workspace/hotel-hrms run build && ${pnpm} --filter @workspace/employee-portal run build`, { stdio: 'inherit', shell: true });
      
      const fs = require('fs');
      const path = require('path');
      console.log('Copying built hrms assets to root public directory...');
      const srcDir = path.resolve(__dirname, 'artifacts', 'hotel-hrms', 'dist', 'public');
      const destDir = path.resolve(__dirname, 'public');
      
      if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
      }
      fs.cpSync(srcDir, destDir, { recursive: true });
      console.log('HRMS assets copied successfully!');
    } catch (error) {
      console.error('[ERROR] Build failed for frontends', error);
      process.exit(1);
    }
  } else {
    console.log('==========================================================');
    console.log('  Standard Build - Building Entire Workspace');
    console.log('==========================================================');
    try {
      execSync(`${pnpm} run typecheck && ${pnpm} -r --if-present run build`, { stdio: 'inherit', shell: true });
    } catch (error) {
      console.error('[ERROR] Monorepo build failed');
      process.exit(1);
    }
  }
}

main();
