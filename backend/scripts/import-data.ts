import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function importData() {
  console.log('🚀 Starting data import to MySQL...');

  const filePath = path.join(__dirname, 'backup_data.json');
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Backup file not found: ${filePath}`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Order matters for relational integrity if we weren't using relationMode = "prisma"
  // But we'll follow a safe order anyway
  const modelsOrder = [
    'User', 'Role', 'Permission', 'RolePermission', 'Bike', 'PricingConfig', 
    'PricingPlan', 'SubscriptionPackage', 'SubscriptionFormula', 
    'SubscriptionPromotionRule', 'FreeDaysRule', 'UserPreferences', 
    'PushToken', 'ActivityLog', 'Wallet', 'Transaction', 'PricingRule', 
    'PricingTier', 'Promotion', 'PromotionPlan', 'Ride', 'MaintenanceLog', 
    'Incident', 'Notification', 'ChatMessage', 'Session', 'Settings', 
    'PlanOverride', 'Review', 'Reservation', 'UnlockRequest', 'LockRequest', 
    'FreeDaysBeneficiary', 'PromotionPackageRelation', 'Subscription', 
    'IdentityDocument', 'ResidenceProof', 'ActivityLocationProof'
  ];

  for (const modelName of modelsOrder) {
    const items = data[modelName];
    if (!items || items.length === 0) continue;

    const prismaModel = (prisma as any)[modelName.charAt(0).toLowerCase() + modelName.slice(1)];
    if (!prismaModel) {
      console.warn(`⚠️ Model ${modelName} not found in Prisma client.`);
      continue;
    }

    console.log(`📥 Importing ${items.length} records into ${modelName}...`);

    // Clean table first (Optional, but recommended for migration)
    await prismaModel.deleteMany({});

    // Import in chunks to avoid large query errors
    const chunkSize = 50;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      
      // We use create because some objects might have nested relations or dates that need parsing
      // But for speed, createMany is better if the provider supports it.
      // MySQL supports createMany.
      try {
        await prismaModel.createMany({
          data: chunk,
          skipDuplicates: true
        });
      } catch (err) {
        console.warn(`⚠️ createMany failed for ${modelName} chunk, falling back to individual creates...`);
        for (const item of chunk) {
          try {
            await prismaModel.create({ data: item });
          } catch (innerErr: any) {
            console.error(`❌ Failed to import record in ${modelName}:`, innerErr.message);
          }
        }
      }
    }
  }

  console.log('✅ Import completed successfully!');
}

importData()
  .catch((e) => {
    console.error('❌ Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
