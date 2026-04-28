import { getDb, DatabaseConnection } from '../config/database';
import { randomUUID } from 'crypto';

export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  where?: Record<string, any>;
}

export abstract class BaseRepository<T> {
  protected tableName: string;
  protected db: DatabaseConnection;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.db = getDb();
  }

  protected isPostgres(): boolean {
    const type = (this.db?.type || '').toLowerCase();
    return type === 'postgres' || type === 'postgresql';
  }

  protected isMysql(): boolean {
    const type = (this.db?.type || '').toLowerCase();
    return type === 'mysql';
  }

  protected isSqlite(): boolean {
    const type = (this.db?.type || '').toLowerCase();
    return type === 'sqlite';
  }

  protected generateId(): string {
    return randomUUID();
  }

  protected quoteIdentifier(name: string): string {
    if (this.isMysql()) {
      return `\`${name}\``;
    }
    // PostgreSQL and SQLite use double quotes for identifiers
    return `"${name}"`;
  }

  protected buildWhereClause(where: Record<string, any>): { clause: string; params: any[] } {
    if (!where || Object.keys(where).length === 0) {
      return { clause: '', params: [] };
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(where)) {
      const quotedKey = this.quoteIdentifier(key);
      if (value === null || value === undefined) {
        conditions.push(`${quotedKey} IS NULL`);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        for (const [operator, opValue] of Object.entries(value)) {
          switch (operator) {
            case 'gte':
              conditions.push(`${quotedKey} >= ${this.getPlaceholder(paramIndex++)}`);
              params.push(Number(opValue));
              break;
            case 'lte':
              conditions.push(`${quotedKey} <= ${this.getPlaceholder(paramIndex++)}`);
              params.push(Number(opValue));
              break;
            case 'gt':
              conditions.push(`${quotedKey} > ${this.getPlaceholder(paramIndex++)}`);
              params.push(Number(opValue));
              break;
            case 'lt':
              conditions.push(`${quotedKey} < ${this.getPlaceholder(paramIndex++)}`);
              params.push(Number(opValue));
              break;
            case 'contains':
              conditions.push(`${quotedKey} LIKE ${this.getPlaceholder(paramIndex++)}`);
              params.push(`%${opValue}%`);
              break;
          }
        }
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => this.getPlaceholder(paramIndex++)).join(', ');
        conditions.push(`${quotedKey} IN (${placeholders})`);
        params.push(...value);
      } else {
        conditions.push(`${quotedKey} = ${this.getPlaceholder(paramIndex++)}`);
        if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
          params.push(Number(value));
        } else {
          params.push(value);
        }
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    };
  }

  protected getPlaceholder(index: number): string {
    if (this.isPostgres()) {
      return `$${index}`;
    }
    return '?';
  }

  protected async executeQuery(sql: string, params?: any[]): Promise<any> {
    try {
      return await this.db.query(sql, params);
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  protected async executeNonQuery(sql: string, params?: any[]): Promise<any> {
    try {
      return await this.db.execute(sql, params);
    } catch (error) {
      console.error('Database execute error:', error);
      throw error;
    }
  }

  async findAll(options: QueryOptions = {}): Promise<T[]> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC', where } = options;
    const offset = (page - 1) * limit;

    const { clause, params } = this.buildWhereClause(where || {});
    const quotedTableName = this.quoteIdentifier(this.tableName);
    const quotedSortBy = this.quoteIdentifier(sortBy);

    let sql = `SELECT * FROM ${quotedTableName} ${clause} ORDER BY ${quotedSortBy} ${sortOrder}`;

    if (this.isPostgres()) {
      sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
    } else {
      sql += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    const rows = await this.executeQuery(sql, params);
    return rows as T[];
  }

  async findById(id: string): Promise<T | null> {
    const quotedTableName = this.quoteIdentifier(this.tableName);
    const sql = `SELECT * FROM ${quotedTableName} WHERE ${this.quoteIdentifier('id')} = ${this.getPlaceholder(1)}`;
    const rows = await this.executeQuery(sql, [id]);
    return rows.length > 0 ? (rows[0] as T) : null;
  }

  async findOne(where: Record<string, any>): Promise<T | null> {
    const { clause, params } = this.buildWhereClause(where);
    const quotedTableName = this.quoteIdentifier(this.tableName);
    const sql = `SELECT * FROM ${quotedTableName} ${clause} LIMIT 1`;
    const rows = await this.executeQuery(sql, params);
    return rows.length > 0 ? (rows[0] as T) : null;
  }

  async count(where?: Record<string, any>): Promise<number> {
    const { clause, params } = this.buildWhereClause(where || {});
    const quotedTableName = this.quoteIdentifier(this.tableName);
    const sql = `SELECT COUNT(*) as count FROM ${quotedTableName} ${clause}`;
    const rows = await this.executeQuery(sql, params);
    return rows[0].count;
  }

  async create(data: Partial<T>): Promise<T> {
    const id = this.generateId();
    const now = new Date();
    
    const fullData = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now
    } as any;

    const columns = Object.keys(fullData);
    const values = Object.values(fullData);
    const quotedColumns = columns.map(col => this.quoteIdentifier(col));
    const placeholders = columns.map((_, i) => this.getPlaceholder(i + 1)).join(', ');

    const quotedTableName = this.quoteIdentifier(this.tableName);
    const sql = `INSERT INTO ${quotedTableName} (${quotedColumns.join(', ')}) VALUES (${placeholders})`;
    
    if (process.env.NODE_ENV !== 'production' || true) { // Log in prod temporarily for debugging
       console.log(`[BaseRepository] Executing CREATE on ${this.tableName} using type: ${this.db?.type}`);
    }

    await this.executeNonQuery(sql, values);

    return fullData as T;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const updateData = {
      ...data,
      updatedAt: new Date()
    } as any;

    const columns = Object.keys(updateData);
    const values = Object.values(updateData);
    
    const setClause = columns.map((col, i) => `${this.quoteIdentifier(col)} = ${this.getPlaceholder(i + 1)}`).join(', ');
    const quotedTableName = this.quoteIdentifier(this.tableName);
    const sql = `UPDATE ${quotedTableName} SET ${setClause} WHERE ${this.quoteIdentifier('id')} = ${this.getPlaceholder(columns.length + 1)}`;
    
    await this.executeNonQuery(sql, [...values, id]);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const quotedTableName = this.quoteIdentifier(this.tableName);
    const sql = `DELETE FROM ${quotedTableName} WHERE ${this.quoteIdentifier('id')} = ${this.getPlaceholder(1)}`;
    const result = await this.executeNonQuery(sql, [id]);
    return result.changes > 0 || result.affectedRows > 0;
  }
}