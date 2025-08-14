import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';
import { registerRoutes } from "./routes";
import { LocalDB } from './local-db';
import { ollamaLLM } from './ollama-llm';

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Add a simple root route for testing
app.get('/', (req, res) => {
  res.json({
    message: 'NPS Analytics Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      upload_preview: 'POST /api/upload/preview',
      upload_commit: 'POST /api/upload/commit',
      responses: 'GET /api/responses',
      nps_stats: 'GET /api/stats/nps',
      sentiment: 'GET /api/stats/sentiment',
      topics: 'GET /api/stats/topics',
      analyze: 'POST /api/analyze/batch'
    },
    timestamp: new Date().toISOString()
  });
});

function log(message: string) {
  console.log(message);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "...";
      }

      log(logLine);
    }
  });

  next();
});

async function initializeAI() {
  console.log('Checking Ollama connection...');
  const connected = await ollamaLLM.checkConnection();
  if (connected) {
    console.log('Ollama is ready');
  } else {
    console.error('Ollama connection failed');
  }
}

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  console.log("Server starting with routes but without Vite...");

  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
    initializeAI();
  });
})();
