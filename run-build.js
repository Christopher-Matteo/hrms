const { execSync } = require('child_process');

function main() {
  if (process.env.VERCEL) {
    console.log('==========================================================');
    console.log('  Vercel Build Router - Deploying HRMS Frontend Only');
    console.log('==========================================================');
    try {
      execSync('pnpm --filter @workspace/hotel-hrms run build', { stdio: 'inherit', shell: true });
    } catch (error) {
      console.error('[ERROR] Build failed for @workspace/hotel-hrms');
      process.exit(1);
    }
  } else {
    console.log('==========================================================');
    console.log('  Standard Build - Building Entire Workspace');
    console.log('==========================================================');
    try {
      execSync('pnpm run typecheck && pnpm -r --if-present run build', { stdio: 'inherit', shell: true });
    } catch (error) {
      console.error('[ERROR] Monorepo build failed');
      process.exit(1);
    }
  }
}

main();
