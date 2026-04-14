const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Script de migration de données entre Jelastic (Source) et Render (Destination)
 * Version sécurisée : Vérifie s'il y a déjà des données avant de migrer.
 */
async function migrate() {
  const sourceUrl = process.env.JELASTIC_DATABASE_URL;
  const destUrl = process.env.RENDER_DATABASE_URL;
  const deployTarget = process.env.DEPLOY_TARGET;
  const forceMigration = process.env.FORCE_MIGRATION === 'true';

  if (deployTarget !== 'RENDER') {
    console.log('⏭️ Migration ignorée : DEPLOY_TARGET n\'est pas RENDER');
    return;
  }

  if (!sourceUrl || !destUrl) {
    console.error('❌ Erreur: JELASTIC_DATABASE_URL ou RENDER_DATABASE_URL manquante.');
    process.exit(1);
  }

  console.log('🔄 Démarrage de la migration de données...');
  
  let sourceConn, destConn;

  try {
    sourceConn = await mysql.createConnection(sourceUrl);
    destConn = await mysql.createConnection(destUrl);

    console.log('✅ Connexions établies.');

    // --- SÉCURITÉ : Vérifier si la destination contient déjà des données ---
    const [tablesDest] = await destConn.query('SHOW TABLES');
    const tableNamesDest = tablesDest.map(row => Object.values(row)[0]);
    
    let existingDataCount = 0;
    for (const tableName of tableNamesDest) {
      if (tableName === '_prisma_migrations') continue;
      
      const [rows] = await destConn.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      existingDataCount += rows[0].count;
    }

    if (existingDataCount > 0 && !forceMigration) {
      console.log(`\n🛑 ARRET DE SÉCURITÉ : La base de destination contient déjà environ ${existingDataCount} enregistrements.`);
      console.log('💡 Migration annulée pour éviter d\'écraser des données existantes.');
      console.log('💡 Pour forcer la migration (écraser tout), réglez FORCE_MIGRATION=true dans Render.');
      return;
    }

    if (forceMigration) {
      console.log('⚠️ MODE FORCÉ : Les données existantes sur la destination vont être écrasées.');
    }

    // --- MIGRATION ---
    await destConn.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('🔓 Clés étrangères désactivées.');

    const [tablesSource] = await sourceConn.query('SHOW TABLES');
    const tableNamesSource = tablesSource.map(row => Object.values(row)[0]);

    for (const tableName of tableNamesSource) {
      if (tableName === '_prisma_migrations') continue;

      console.log(`⏳ Migration table: ${tableName}...`);

      const [rows] = await sourceConn.query(`SELECT * FROM \`${tableName}\``);
      
      if (rows.length === 0) {
        console.log(`  ⚪ Vide.`);
        continue;
      }

      await destConn.query(`TRUNCATE TABLE \`${tableName}\``);

      const keys = Object.keys(rows[0]);
      const sql = `INSERT INTO \`${tableName}\` (${keys.map(k => `\`${k}\``).join(', ')}) VALUES ?`;
      const values = rows.map(row => keys.map(key => row[key]));

      const CHUNK_SIZE = 1000;
      for (let i = 0; i < values.length; i += CHUNK_SIZE) {
        const chunk = values.slice(i, i + CHUNK_SIZE);
        await destConn.query(sql, [chunk]);
      }

      console.log(`  ✅ ${rows.length} migrés.`);
    }

    await destConn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🔒 Clés étrangères réactivées.');
    console.log('🚀 Migration terminée avec succès !');

  } catch (error) {
    console.error('❌ Échec de la migration:', error.message);
  } finally {
    if (sourceConn) await sourceConn.end();
    if (destConn) await destConn.end();
  }
}

migrate();
