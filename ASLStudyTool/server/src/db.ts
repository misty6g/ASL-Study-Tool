import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import winston from 'winston';

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Setup pg Pool
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  logger.error('DATABASE_URL is not defined in environment variables.');
  process.exit(1);
}

export const pool = new Pool({
  connectionString,
  // Optional: max connections, timeouts, etc.
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', err);
});

/**
 * Initializes the database by executing the bootstrap migration.
 */
export const initDatabase = async () => {
  const client = await pool.connect();
  try {
    logger.info('Connected to PostgreSQL. Running database migration bootstrap...');
    
    // Read the initialization SQL file
    const migrationPath = path.join(__dirname, 'db/migrations/001_database_init.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration script not found at path: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL migration script
    await client.query(sql);
    logger.info('Database schema successfully verified/initialized.');
  } catch (error: any) {
    logger.error('Error during database initialization migration:', error);
    throw error;
  } finally {
    client.release();
  }
};
