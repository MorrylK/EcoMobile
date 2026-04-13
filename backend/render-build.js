const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Render deployment...');

/**
 * Exécute une commande avec des tentatives de retry
 */
function execWithRetry(command, options = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return execSync(command, { stdio: 'inherit', ...options });
    } catch (error) {
      if (i === retries) throw error;
      console.log(`⚠️ Command failed: "${command}". Retrying in 5s... (${i + 1}/${retries})`);
      execSync('sleep 5'); // Simple pause
    }
  }
}

// 1. Détection automatique de l'environnement
const isRender = process.env.RENDER === 'true';
const deployTarget = process.env.DEPLOY_TARGET || (isRender ? 'RENDER' : 'JELASTIC');

console.log(`🌍 Environment: ${isRender ? 'RENDER' : 'LOCAL/OTHER'}`);
console.log(`🌐 Deployment Target: ${deployTarget}`);

// 2. Configuration dynamique de la base de données
if (deployTarget === 'RENDER') {
  if (process.env.RENDER_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.RENDER_DATABASE_URL;
    console.log('✅ DATABASE_URL set from RENDER_DATABASE_URL');
  } else {
    console.warn('⚠️ RENDER_DATABASE_URL is not defined. Using default DATABASE_URL if available.');
  }
} else if (process.env.JELASTIC_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.JELASTIC_DATABASE_URL;
  console.log('✅ DATABASE_URL set from JELASTIC_DATABASE_URL');
}

// Masquage de l'URL pour les logs de sécurité
if (process.env.DATABASE_URL) {
  const maskedUrl = process.env.DATABASE_URL.replace(/:([^@]+)@/, ':****@');
  console.log(`🔌 Database connection string: ${maskedUrl}`);
}

try {
  // 1. Installation complète
  console.log('📦 Installing all dependencies...');
  execSync('npm ci', { stdio: 'inherit' });

  // 2. Migration des données (optionnel)
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

  // 5. Mise à jour du schéma (Résilience aux erreurs réseau)
  if (process.env.SKIP_DB_SYNC_ON_BUILD === 'true') {
    console.log('⏩ Skipping database schema sync during build as requested.');
  } else {
    console.log('🔌 Syncing database schema...');
    try {
      // On utilise npx prisma db push avec un timeout ou des retries si possible
      execWithRetry('npx prisma db push', {}, 1);
    } catch (dbError) {
      console.error('\n❌ CRITICAL DATABASE ERROR DURING BUILD:');
      console.error(dbError.message);
      console.error('\n⚠️ The database is unreachable (P1001/P1017) from the build environment.');
      console.log('💡 Suggestion: Check Aiven IP Filter (allow 0.0.0.0/0).');
      console.log('💡 Deployment will continue because the server can sync at runtime.');
    }
  }

  // 6. Seed intelligent
  console.log('🌱 Seeding database...');
  try {
    execSync('npm run db:seed', { stdio: 'inherit' });
    console.log('✅ Database seeded successfully!');
  } catch (seedError) {
    console.log('⚠️ Seed failed or database unreachable, continuing deployment...');
  }

  console.log('✅ Render build completed successfully!');
} catch (error) {
  console.error('❌ Build failed critical step:', error.message);
  process.exit(1);
}