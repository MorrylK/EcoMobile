import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function exportData() {
  console.log('🚀 Starting data export from PostgreSQL...');

  const data: any = {};
  
  // List of models in the order of dependencies (optional but helpful)
  const models = [
    'User', 'UserPreferences', 'PushToken', 'Role', 'Permission', 'RolePermission',
    'ActivityLog', 'Wallet', 'Transaction', 'Bike', 'PricingConfig', 'PricingPlan',
    'PricingRule', 'PricingTier', 'Promotion', 'PromotionPlan', 'Ride',
    'MaintenanceLog', 'Incident', 'Notification', 'ChatMessage', 'Session',
    'Settings', 'PlanOverride', 'Review', 'Reservation', 'UnlockRequest',
    'LockRequest', 'SubscriptionPackage', 'SubscriptionFormula',
    'SubscriptionPromotionRule', 'FreeDaysRule', 'FreeDaysBeneficiary',
    'PromotionPackageRelation', 'Subscription', 'IdentityDocument',
    'ResidenceProof', 'ActivityLocationProof'
  ];

  for (const modelName of models) {
    const prismaModel = (prisma as any)[modelName.charAt(0).toLowerCase() + modelName.slice(1)];
    if (prismaModel) {
      console.log(`📦 Exporting ${modelName}...`);
      data[modelName] = await prismaModel.findMany();
    } else {
      console.warn(`⚠️ Model ${modelName} not found in Prisma client.`);
    }
  }

  const filePath = path.join(__dirname, 'backup_data.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  console.log(`✅ Export completed! Data saved to: ${filePath}`);
}

exportData()
  .catch((e) => {
    console.error('❌ Export failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
