const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

dotenv.config();

/**
 * Script de migration de données entre Jelastic (Source) et Render (Destination)
 */
async function migrate() {
  const sourceUrl = process.env.JELASTIC_DATABASE_URL;
  const destUrl = process.env.RENDER_DATABASE_URL;
  const deployTarget = process.env.DEPLOY_TARGET;

  if (deployTarget !== 'RENDER') {
    console.log('⏭️ Migration ignorée : DEPLOY_TARGET n\'est pas RENDER');
    return;
  }

  if (!sourceUrl || !destUrl) {
    console.error('❌ Erreur: JELASTIC_DATABASE_URL ou RENDER_DATABASE_URL manquante dans .env');
    process.exit(1);
  }

  console.log('🔄 Démarrage de la migration des données...');
  console.log(`📡 Source (Jelastic): ${sourceUrl.split('@')[1]}`);
  console.log(`📡 Destination (Render External): ${destUrl.split('@')[1]}`);

  let sourceConn, destConn;

  try {
    // Connexion aux deux bases
    sourceConn = await mysql.createConnection(sourceUrl);
    destConn = await mysql.createConnection(destUrl);

    console.log('✅ Connexions établies.');

    // 1. Désactiver les contraintes de clés étrangères sur la destination (si applicable)
    await destConn.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('🔓 Vérification des clés étrangères désactivée sur la destination.');

    // 2. Récupérer toutes les tables de la source
    const [tables] = await sourceConn.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);

    console.log(`📋 ${tableNames.length} tables trouvées à migrer.`);

    for (const tableName of tableNames) {
      if (tableName === '_prisma_migrations') continue; // On laisse Prisma gérer ça

      console.log(`⏳ Migration de la table: ${tableName}...`);

      // Récupérer les données
      const [rows] = await sourceConn.query(`SELECT * FROM \`${tableName}\``);
      
      if (rows.length === 0) {
        console.log(`  ⚪ Table ${tableName} vide, on continue.`);
        continue;
      }

      // Vider la table destination (facultatif mais recommandé pour éviter les doublons lors des retries)
      await destConn.query(`TRUNCATE TABLE \`${tableName}\``);

      // Préparer l'insertion massive
      const keys = Object.keys(rows[0]);
      const sql = `INSERT INTO \`${tableName}\` (${keys.map(k => `\`${k}\``).join(', ')}) VALUES ?`;
      const values = rows.map(row => keys.map(key => row[key]));

      // Insérer par paquets de 1000 pour éviter d'exploser la mémoire/buffer
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < values.length; i += CHUNK_SIZE) {
        const chunk = values.slice(i, i + CHUNK_SIZE);
        await destConn.query(sql, [chunk]);
      }

      console.log(`  ✅ ${rows.length} enregistrements migrés.`);
    }

    // 3. Réactiver les contraintes
    await destConn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🔒 Vérification des clés étrangères réactivée.');

    console.log('🚀 Migration terminée avec succès !');

  } catch (error) {
    console.error('❌ Échec de la migration:', error.message);
    if (error.code === 'ECONNREFUSED' || error.message.includes('ETIMEDOUT')) {
      console.log('\n💡 CONSEIL: Vérifiez que votre base Jelastic est accessible publiquement ou par IP blanche.');
    }
  } finally {
    if (sourceConn) await sourceConn.end();
    if (destConn) await destConn.end();
  }
}

migrate();
