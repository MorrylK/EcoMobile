import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: path.join(__dirname, '../../.env.production') });
} else {
  dotenv.config();
}

import { config } from './config/config';
import { swaggerSpec } from './config/swagger';
import { prisma } from './config/prisma';
import { dbManager } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { i18nMiddleware } from './middleware/i18n';

const app = express();

// Trust Cloudflare Proxy (Plus permissif)
app.set('trust proxy', true);

// Empêcher Express de rediriger pour ajouter/enlever des slashs (évite les 301 sur les preflights)
app.set('strict routing', true);

// 1. Log Interceptor (Pour debugger en production via Docker logs)
app.use((req, _res, next) => {
  if (process.env.NODE_ENV === 'production') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Proto: ${req.protocol} - Host: ${req.get('host')}`);
  }
  next();
});

// 2. Intercepteur manuel de requêtes OPTIONS (CORS Preflight)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Accept-Language, Origin, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    res.sendStatus(200);
    return;
  }
  next();
});

// CORS Configuration dynamique selon .env
app.use(cors({
  origin: (origin, callback) => {
    // Permettre les requêtes sans origine (applications mobiles, Postman, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // En développement, tout permettre
    if (config.env === 'development') {
      callback(null, true);
      return;
    }
    
    // En production, vérifier l'origine
    if (config.cors.origin.includes(origin) || config.cors.origin.includes('*')) {
      callback(null, true);
      return;
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'Origin', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Certains navigateurs anciens pourraient en avoir besoin
}));

// Security Middleware (Après CORS pour éviter de bloquer les OPTIONS)
app.use(helmet({
  hsts: false // Désactivé car géré par Cloudflare, évite les redirections conflictuelles
}));

// Body Parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// i18n Middleware
app.use(i18nMiddleware);

// Static files - Serve uploads directory
// In development, serve from project root
// In production (after build), serve from dist folder
const uploadsPathDev = path.join(process.cwd(), 'uploads');
const uploadsPathProd = path.join(__dirname, '../uploads');
const uploadsPathDist = path.join(__dirname, '../dist/uploads');

// Serve static files from uploads directory
// This will serve /uploads/documents/... correctly
if (fs.existsSync(uploadsPathDev)) {
  app.use('/uploads', express.static(uploadsPathDev));
} else if (fs.existsSync(uploadsPathProd)) {
  app.use('/uploads', express.static(uploadsPathProd));
} else if (fs.existsSync(uploadsPathDist)) {
  app.use('/uploads', express.static(uploadsPathDist));
}

// Health Check
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    message: 'EcoMobile API is running',
    timestamp: new Date().toISOString(),
    environment: config.env,
    database: process.env.DATABASE_TYPE || 'unknown'
  });
});

// Root Endpoint
app.get('/', (_req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    message: '🚲 EcoMobile API - Welcome!',
    version: config.apiVersion,
    environment: config.env,
    timestamp: new Date().toISOString(),
    documentation: '/api-docs',
    health: '/health',
    api: `/api/${config.apiVersion}`
  });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'EcoMobile API Documentation'
}));

// Seed endpoint (seulement en développement)
app.post('/api/seed', async (_req: express.Request, res: express.Response): Promise<void> => {
  if (process.env.NODE_ENV !== 'development') {
    res.status(403).json({
      success: false,
      message: 'Seeding only allowed in development mode'
    });
    return;
  }

  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync('npx ts-node prisma/seed.ts');
    
    console.log('Seed output:', stdout);
    if (stderr) console.error('Seed errors:', stderr);

    res.json({
      success: true,
      message: 'Database seeded successfully',
      output: stdout
    });
  } catch (error: any) {
    console.error('Seed failed:', error);
    res.status(500).json({
      success: false,
      message: 'Seed failed',
      error: error.message || 'Unknown error occurred'
    });
  }
});

// Function to create a formatted line with label and value
const createFormattedLine = (label: string, value: string, totalWidth: number = 61): string => {
  const prefix = '║   ';
  const middle = ': ';
  const labelWithMiddle = `${label}${middle}${value}`;
  
  const spacesNeeded = totalWidth - prefix.length - labelWithMiddle.length - 1;
  
  return `${prefix}${label}${middle}${value}${' '.repeat(Math.max(0, spacesNeeded))}║`;
};

// Function to create a title line
const createTitleLine = (title: string, totalWidth: number = 61): string => {
  const prefix = '║   ';
  const spacesNeeded = totalWidth - prefix.length - title.length - 1;
  
  return `${prefix}${title}${' '.repeat(Math.max(0, spacesNeeded))}║`;
};

// Function to create a URL line
const createUrlLine = (url: string, totalWidth: number = 61): string => {
  const prefix = '║      ';
  const spacesNeeded = totalWidth - prefix.length - url.length - 1;
  
  return `${prefix}${url}${' '.repeat(Math.max(0, spacesNeeded))}║`;
};

// Function to create an empty line
const createEmptyLine = (totalWidth: number = 61): string => {
  return `║${' '.repeat(totalWidth - 2)}║`;
};

// Start Server
const PORT = Number(process.env.PORT || config.port);
const HOST = '0.0.0.0';

const startServer = async () => {
  try {
    console.log('🔄 Starting server initialization...');
    
    // 1. Connect Prisma
    await prisma.$connect();
    console.log('✅ Prisma database connected successfully');

    // 2. Connect DatabaseManager
    if (dbManager && typeof dbManager.connect === 'function') {
      await dbManager.connect();
      console.log('✅ DatabaseManager connected successfully');
    }

    // 3. Load Routes
    const routes = await import('./routes');
    app.use(`/api/${config.apiVersion}`, routes.default);
    console.log('✅ Routes loaded successfully');

    // 404 Handler
    app.use((_req: express.Request, res: express.Response) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    });

    // Error Handler
    app.use(errorHandler);

    app.listen(PORT, HOST, () => {
      const environment = process.env.NODE_ENV || 'development';
      const portStr = PORT.toString();
      const hostStr = HOST;
      const apiVersion = config.apiVersion;
      const docsUrl = `http://${HOST}:${PORT}/api-docs`;
      const baseUrl = `http://${HOST}:${PORT}/api/${apiVersion}`;

      console.log(`
╔═══════════════════════════════════════════════════════════╗
${createEmptyLine()}
║   🚲 EcoMobile API Server                                 ║
${createEmptyLine()}
${createFormattedLine('Environment', environment)}
${createFormattedLine('Port', portStr)}
${createFormattedLine('Host', hostStr)}
${createFormattedLine('API Version', apiVersion)}
${createEmptyLine()}
${createTitleLine('📖 API Documentation')}
${createUrlLine(docsUrl)}
${createEmptyLine()}
${createTitleLine('🌐 Base URL')}
${createUrlLine(baseUrl)}
${createEmptyLine()}
╚═══════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful Shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  if (dbManager && typeof dbManager.disconnect === 'function') {
    await dbManager.disconnect();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  if (dbManager && typeof dbManager.disconnect === 'function') {
    await dbManager.disconnect();
  }
  process.exit(0);
});

startServer();

export default app;