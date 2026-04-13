const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Render deployment...');

// 1. Configuration dynamique de la base de données
const deployTarget = process.env.DEPLOY_TARGET || 'JELASTIC';
if (deployTarget === 'RENDER') {
  console.log('🌐 Deployment Target: RENDER');
  if (process.env.RENDER_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.RENDER_DATABASE_URL;
    console.log('✅ DATABASE_URL set to RENDER_DATABASE_URL');
  } else {
    console.error('❌ RENDER_DATABASE_URL is not defined');
    process.exit(1);
  }
} else {
  console.log('🏢 Deployment Target: JELASTIC');
  if (process.env.JELASTIC_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.JELASTIC_DATABASE_URL;
    console.log('✅ DATABASE_URL set to JELASTIC_DATABASE_URL');
  }
}

try {
  // 1. Installation complète
  console.log('📦 Installing all dependencies...');
  execSync('npm ci', { stdio: 'inherit' });

  // 2. Migration des données de Jelastic vers Render (optionnel)
  if (deployTarget === 'RENDER' && process.env.RUN_MIGRATION === 'true') {
    console.log('🚚 Running data migration from Jelastic...');
    try {
      execSync('node scripts/migrate-db.js', { stdio: 'inherit' });
    } catch (migError) {
      console.error('⚠️ Migration failed, but continuing with build:', migError.message);
    }
  }

  // 3. Génération Prisma Client
  console.log('🔧 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // 4. Build TypeScript
  console.log('🏗️ Building TypeScript...');
  execSync('npm run build', { stdio: 'inherit' });

  // Ensure uploads directory exists in dist
  const distUploadsDir = path.join(__dirname, 'dist', 'uploads');
  if (!fs.existsSync(distUploadsDir)) {
    console.log('📁 Creating dist/uploads directory...');
    fs.mkdirSync(distUploadsDir, { recursive: true });
  }

  // 5. Mise à jour du schéma sur la nouvelle BD
  console.log('🔌 Syncing database schema...');
  execSync('npx prisma db push', { stdio: 'inherit' });

  // 6. Seed intelligent avec plusieurs méthodes
  console.log('🌱 Seeding database...');
  
  const seedMethods = [
    () => execSync('npx prisma db seed', { stdio: 'inherit' }),
    () => execSync('npx ts-node prisma/seed.ts', { stdio: 'inherit' }),
    () => execSync('npm run db:seed', { stdio: 'inherit' }),
  ];

  let seedSuccessful = false;
  
  for (let i = 0; i < seedMethods.length; i++) {
    try {
      console.log(`🔄 Trying seed method ${i + 1}...`);
      seedMethods[i]();
      console.log('✅ Database seeded successfully!');
      seedSuccessful = true;
      break;
    } catch (seedError) {
      console.log(`⚠️ Seed method ${i + 1} failed:`, seedError.message);
    }
  }

  if (!seedSuccessful) {
    console.log('⚠️ All seed methods failed, but continuing deployment...');
    console.log('💡 You can manually seed later using: npm run db:seed');
  }

  console.log('✅ Render build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}