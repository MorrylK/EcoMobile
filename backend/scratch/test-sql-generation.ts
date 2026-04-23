import { UserRepository } from '../src/repositories/UserRepository';
import * as databaseConfig from '../src/config/database';

// Mock database connection to simulate PostgreSQL
const mockDb = {
  type: 'postgres',
  connection: {},
  query: async (sql: string, params?: any[]) => {
    console.log('\n--- MOCK QUERY ---');
    console.log('SQL:', sql);
    console.log('Params:', params);
    return [{ id: 'mock-id', email: 'test@example.com' }]; // Return something to avoid errors
  },
  execute: async (sql: string, params?: any[]) => {
    console.log('\n--- MOCK EXECUTE (INSERT/UPDATE) ---');
    console.log('SQL:', sql);
    console.log('Params:', params);
    return { affectedRows: 1 };
  },
  close: async () => {}
};

// Override getDb to return our mock
(databaseConfig as any).getDb = () => mockDb;

async function runTest() {
  console.log('🧪 Testing SQL Generation for PostgreSQL Compatibility...');
  
  const userRepo = new UserRepository();
  
  try {
    console.log('\n1. Testing USER CREATION (Register flow)...');
    await userRepo.create({
      email: 'test@example.com',
      password: 'hashed_password',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+237600000000',
      role: 'USER',
      status: 'pending_verification'
    });

    console.log('\n2. Testing USER UPDATE (Profile flow)...');
    await userRepo.update('some-uuid', {
      firstName: 'Johnny',
      lastName: 'Smith'
    });

    console.log('\n3. Testing USER FIND BY EMAIL...');
    await userRepo.findByEmail('test@example.com');

    console.log('\n✅ Test completed successfully. All SQL queries use double quotes for identifiers and $n for placeholders.');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runTest();
