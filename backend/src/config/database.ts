import mysql from 'mysql2/promise';
import { Pool as PgPool } from 'pg';
import sqlite3 from 'sqlite3';
import { Client as CassandraClient } from 'cassandra-driver';
import { MongoClient } from 'mongodb';
import { config } from './config';

// Database Connection Interface
export interface DatabaseConnection {
  type: string;
  connection: any;
  query: (sql: string, params?: any[]) => Promise<any>;
  execute: (sql: string, params?: any[]) => Promise<any>;
  close: () => Promise<void>;
}

class DatabaseManager {
  private static instance: DatabaseManager;
  private connection: DatabaseConnection | null = null;

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async connect(): Promise<DatabaseConnection> {
    if (this.connection) {
      console.log('✅ DatabaseManager - Already connected, returning existing connection');
      return this.connection;
    }

    let dbType = config.database.type;

    // Auto-detect from DATABASE_URL if available
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
        console.log('🔄 DatabaseManager - Auto-detected PostgreSQL from DATABASE_URL');
        dbType = 'postgres';
      } else if (databaseUrl.startsWith('mysql://')) {
        console.log('🔄 DatabaseManager - Auto-detected MySQL from DATABASE_URL');
        dbType = 'mysql';
      }
    }

    switch (dbType) {
      case 'mysql':
        this.connection = await this.connectMySQL();
        break;
      case 'postgres':
        this.connection = await this.connectPostgreSQL();
        break;
      case 'sqlite':
        this.connection = await this.connectSQLite();
        break;
      case 'mongodb':
        this.connection = await this.connectMongoDB();
        break;
      case 'cassandra':
        this.connection = await this.connectCassandra();
        break;
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }

    console.log(`✅ Connected to ${dbType} database`);
    return this.connection;
  }

  private async connectMySQL(): Promise<DatabaseConnection> {

  const databaseUrl = process.env.DATABASE_URL;

  const pool = databaseUrl
    ? mysql.createPool(databaseUrl)
    : mysql.createPool({
        host: config.database.mysql.host,
        port: config.database.mysql.port,
        user: config.database.mysql.user,
        password: config.database.mysql.password,
        database: config.database.mysql.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

  console.log(
    databaseUrl
      ? '🗄️ MySQL using DATABASE_URL (production mode)'
      : '🗄️ MySQL using MYSQL_* config (local mode)'
  );

  // Test connection
  const conn = await pool.getConnection();
  conn.release();

  return {
    type: 'mysql',
    connection: pool,
    query: async (sql: string, params?: any[]) => {
      const [rows] = await pool.execute(sql, params);
      return rows;
    },
    execute: async (sql: string, params?: any[]) => {
      const [result] = await pool.execute(sql, params);
      return result;
    },
    close: async () => {
      await pool.end();
    }
  };
  }

  private async connectPostgreSQL(): Promise<DatabaseConnection> {
    const databaseUrl = process.env.DATABASE_URL;
    
    const poolConfig = databaseUrl 
      ? { connectionString: databaseUrl, max: 10, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }
      : {
          host: config.database.postgres.host,
          port: config.database.postgres.port,
          user: config.database.postgres.user,
          password: config.database.postgres.password,
          database: config.database.postgres.database,
          max: 10
        };

    const pool = new PgPool(poolConfig);

    console.log(
      databaseUrl
        ? '🗄️ PostgreSQL using DATABASE_URL (production mode)'
        : '🗄️ PostgreSQL using POSTGRES_* config (local mode)'
    );

    // Test connection
    await pool.query('SELECT NOW()');

    return {
      type: 'postgres',
      connection: pool,
      query: async (sql: string, params?: any[]) => {
        const result = await pool.query(sql, params);
        return result.rows;
      },
      execute: async (sql: string, params?: any[]) => {
        const result = await pool.query(sql, params);
        return result;
      },
      close: async () => {
        await pool.end();
      }
    };
  }

  private async connectSQLite(): Promise<DatabaseConnection> {
    const db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const database = new sqlite3.Database(
        config.database.sqlite.path,
        (err) => {
          if (err) reject(err);
          else resolve(database);
        }
      );
    });

    return {
      type: 'sqlite',
      connection: db,
      query: async (sql: string, params?: any[]) => {
        return new Promise((resolve, reject) => {
          db.all(sql, params || [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
      },
      execute: async (sql: string, params?: any[]) => {
        return new Promise((resolve, reject) => {
          db.run(sql, params || [], function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
          });
        });
      },
      close: async () => {
        return new Promise((resolve, reject) => {
          db.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    };
  }

  private async connectMongoDB(): Promise<DatabaseConnection> {
    const client = new MongoClient(config.database.mongodb.uri);
    await client.connect();
    
    const db = client.db();

    return {
      type: 'mongodb',
      connection: { client, db },
      query: async (collection: string, filter?: any) => {
        return db.collection(collection).find(filter || {}).toArray();
      },
      execute: async (collection: string, _operation: any) => {
        // Operation should be an object like { insertOne: { document }, updateOne: { filter, update }, etc. }
        return db.collection(collection);
      },
      close: async () => {
        await client.close();
      }
    };
  }

  private async connectCassandra(): Promise<DatabaseConnection> {
    const client = new CassandraClient({
      contactPoints: [config.database.cassandra.contactPoints],
      localDataCenter: config.database.cassandra.localDataCenter,
      keyspace: config.database.cassandra.keyspace
    });

    await client.connect();

    return {
      type: 'cassandra',
      connection: client,
      query: async (cql: string, params?: any[]) => {
        const result = await client.execute(cql, params || [], { prepare: true });
        return result.rows;
      },
      execute: async (cql: string, params?: any[]) => {
        return client.execute(cql, params || [], { prepare: true });
      },
      close: async () => {
        await client.shutdown();
      }
    };
  }

  public getConnection(): DatabaseConnection {
    if (!this.connection) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.connection;
  }

  public async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      console.log('✅ Database disconnected');
    }
  }
}

export const dbManager = DatabaseManager.getInstance();

export const getDb = () => {
  return dbManager.getConnection();
};
