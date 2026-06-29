import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { execFile } from "child_process";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { storageGetBuffer } from "../storage";
import { addSSEClient, getConnectedClientCount } from "../sse";
import { setupWebSocket, getWebSocketClientCount } from "../ws";
import archiver from "archiver";
import { parentRouter } from "../parentApi";
import { startCronJobs } from "../cronJobs";

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

  // ── Certificate Generation Endpoint ─────────────────────────────────
  // POST /api/exam/certificates - Generate certificates for passed candidates
  // Body: { examId: number } OR { students: [{name, belt_level, exam_date}] }
  app.post('/api/exam/certificates', async (req, res) => {
    console.log('[Certificate] Request received:', { examId: req.body?.examId, hasStudents: !!req.body?.students });
    try {
      const { examId, students } = req.body;
      
      if (!examId && !students) {
        return res.status(400).json({ error: 'Must provide examId or students array' });
      }
      
      // Save to public downloads directory for reliable serving
      const downloadsDir = path.join(process.cwd(), 'public/downloads');
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      const pdfFilename = `certs_${examId || 'custom'}_${timestamp}.pdf`;
      const outputPath = path.join(downloadsDir, pdfFilename);
      const scriptPath = path.join(process.cwd(), 'server/generate-certs.py');
      
      console.log('[Certificate] Script path:', scriptPath, 'exists:', fs.existsSync(scriptPath));
      
      let args: string[];
      if (examId) {
        args = ['--exam-id', String(examId), '--output', outputPath];
      } else {
        // Write students data to temp JSON file
        const jsonPath = `/tmp/cert_data_${timestamp}.json`;
        fs.writeFileSync(jsonPath, JSON.stringify(students), 'utf-8');
        args = ['--json-file', jsonPath, '--output', outputPath];
      }
      
      // Execute Python script
      await new Promise<void>((resolve, reject) => {
        execFile('python3', [scriptPath, ...args], { timeout: 120000 }, (error, stdout, stderr) => {
          if (error) {
            console.error('[Certificate] Generation error:', stderr || error.message);
            reject(new Error(stderr || error.message));
            return;
          }
          try {
            const result = JSON.parse(stdout);
            console.log('[Certificate] Script result:', result);
            if (!result.success) {
              reject(new Error(result.error || 'Generation failed'));
            } else {
              resolve();
            }
          } catch (e) {
            reject(new Error(`Invalid script output: ${stdout}`));
          }
        });
      });
      
      // Verify file exists
      if (!fs.existsSync(outputPath)) {
        console.error('[Certificate] PDF file not found at:', outputPath);
        return res.status(500).json({ error: 'PDF file not generated' });
      }
      
      const fileSize = fs.statSync(outputPath).size;
      console.log('[Certificate] PDF ready:', outputPath, `(${(fileSize/1024/1024).toFixed(1)}MB)`);
      
      // Return download URL instead of streaming (more reliable for large files)
      const downloadUrl = `/downloads/${pdfFilename}`;
      res.json({ 
        success: true, 
        downloadUrl,
        fileSize,
        count: examId ? undefined : (students?.length || 0),
      });
      
      // Schedule cleanup after 10 minutes
      setTimeout(() => {
        fs.unlink(outputPath, () => {});
      }, 10 * 60 * 1000);
      
    } catch (error: any) {
      console.error('[Certificate] Generation failed:', error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Certificate generation failed' });
      }
    }
  });

  // GET /api/exam/certificates/preview - Get list of candidates who would get certificates
  app.get('/api/exam/certificates/preview/:examId', async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      if (isNaN(examId)) {
        return res.status(400).json({ error: 'Invalid examId' });
      }
      
      const scriptPath = path.join(process.cwd(), 'server/generate-certs.py');
      
      // Use Python script to get candidates (reusing same DB logic)
      const previewScript = `
import sys, json, mysql.connector
conn = mysql.connector.connect(host='localhost', user='tkd_user', password='tkd_pass_2026', database='taekwondo', charset='utf8mb4')
cursor = conn.cursor(dictionary=True)
cursor.execute("SELECT exam_date FROM exam_sessions WHERE id = %s", (${examId},))
exam = cursor.fetchone()
if not exam:
    print(json.dumps({"error": "Exam not found"}))
    sys.exit(0)
exam_date = exam['exam_date'].strftime('%Y-%m-%d')
cursor.execute("""
    SELECT ec.id, ec.name, ec.target_belt, ec.current_belt, ec.has_lak_lak_award
    FROM exam_candidates ec
    WHERE ec.exam_id = %s AND ec.status != 'absent'
    ORDER BY ec.target_belt, ec.name
""", (${examId},))
candidates = cursor.fetchall()
cursor.close()
conn.close()
print(json.dumps({"examDate": exam_date, "candidates": candidates}, default=str))
`;
      
      const result = await new Promise<string>((resolve, reject) => {
        execFile('python3', ['-c', previewScript], { timeout: 10000 }, (error, stdout, stderr) => {
          if (error) reject(new Error(stderr || error.message));
          else resolve(stdout.trim());
        });
      });
      
      const data = JSON.parse(result);
      if (data.error) {
        return res.status(404).json({ error: data.error });
      }
      
      res.json(data);
    } catch (error: any) {
      console.error('Certificate preview failed:', error.message);
      res.status(500).json({ error: error.message });
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

  // WebSocket status endpoint (for debugging)
  app.get('/api/ws-status', (_req, res) => {
    res.json({ wsClients: getWebSocketClientCount() });
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

  // ── Parent App REST API (v1) ──
  // CORS bypass for mobile app (no Origin header)
  app.use('/api/v1/parent', express.json({ limit: '15mb' }), parentRouter);

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

  // Setup WebSocket server (attached to HTTP server for upgrade handling)
  setupWebSocket(server);

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
    // Start scheduled cron jobs (e.g. overdue payment reminders)
    startCronJobs();
  });
}

startServer().catch(console.error);
