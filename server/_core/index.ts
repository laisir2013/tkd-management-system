import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { storageGetBuffer } from "../storage";
import { addSSEClient, getConnectedClientCount } from "../sse";
import archiver from "archiver";
import { parentRouter } from "../parentApi";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  // Trust proxy headers (X-Forwarded-Proto etc.) for correct HTTPS/cookie handling
  app.set("trust proxy", 1);
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Static file downloads (e.g. Excel reports)
  app.use('/downloads', express.static(path.join(process.cwd(), 'public/downloads')));
  
  // Serve receipt images from Cloudflare R2
  // Usage: /api/receipts/receipts/42-1234567890.jpg
  //    or: /api/receipts/accounting-receipts/1234567890.png
  app.get('/api/receipts/*', async (req, res) => {
    try {
      const key = req.params[0]; // Everything after /api/receipts/
      if (!key) {
        return res.status(400).json({ error: 'Missing file key' });
      }
      const { data, contentType } = await storageGetBuffer(key);
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400'); // Cache 24 hours
      res.send(data);
    } catch (error: any) {
      console.error('Failed to serve receipt:', error.message);
      res.status(404).json({ error: 'Receipt not found' });
    }
  });

  // Download single receipt with Content-Disposition for browser download
  app.get('/api/receipt-download/*', async (req, res) => {
    try {
      const key = req.params[0];
      if (!key) {
        return res.status(400).json({ error: 'Missing file key' });
      }
      const { data, contentType } = await storageGetBuffer(key);
      const filename = key.split('/').pop() || 'receipt';
      res.set('Content-Type', contentType);
      res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(data);
    } catch (error: any) {
      console.error('Failed to download receipt:', error.message);
      res.status(404).json({ error: 'Receipt not found' });
    }
  });

  // Batch download receipts as ZIP
  // POST body: { receipts: [{ key: "receipts/...", filename: "學生名_日期.jpg" }] }
  app.post('/api/receipts-batch-download', async (req, res) => {
    try {
      const { receipts } = req.body;
      if (!receipts || !Array.isArray(receipts) || receipts.length === 0) {
        return res.status(400).json({ error: 'No receipts specified' });
      }

      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename="receipts_${Date.now()}.zip"`);

      const archive = archiver('zip', { zlib: { level: 5 } });
      archive.pipe(res);

      let addedCount = 0;
      for (const item of receipts) {
        try {
          // Extract key from receiptUrl: /api/receipts/xxx → xxx
          let key = item.key || '';
          if (key.startsWith('/api/receipts/')) {
            key = key.replace('/api/receipts/', '');
          }
          if (!key) continue;

          const { data } = await storageGetBuffer(key);
          const filename = item.filename || key.split('/').pop() || `receipt_${addedCount}.jpg`;
          archive.append(data, { name: filename });
          addedCount++;
        } catch (e: any) {
          console.warn(`[BatchDownload] Skipping ${item.key}: ${e.message}`);
        }
      }

      if (addedCount === 0) {
        archive.abort();
        return res.status(404).json({ error: 'No receipts found' });
      }

      await archive.finalize();
    } catch (error: any) {
      console.error('Batch download failed:', error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Batch download failed' });
      }
    }
  });
  
  // SSE endpoint for real-time exam scoring sync
  app.get('/api/exam/sse/:examId', (req, res) => {
    const examId = parseInt(req.params.examId);
    if (isNaN(examId)) {
      return res.status(400).json({ error: 'Invalid examId' });
    }
    addSSEClient(res, examId);
  });

  // SSE connected clients count (for debugging)
  app.get('/api/exam/sse-status', (_req, res) => {
    res.json({ connectedClients: getConnectedClientCount() });
  });

  // ── Parent App REST API (for mobile app) ─────────────────────────────
  // CORS: allow requests without Origin header (mobile apps)
  app.use('/api/v1/parent', (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use('/api/v1/parent', parentRouter);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
