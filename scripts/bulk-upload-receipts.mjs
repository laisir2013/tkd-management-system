#!/usr/bin/env node
/**
 * Bulk download receipt images from Google Drive and upload to local storage.
 * Updates exam_payments and accounting_records tables with receipt URLs.
 * 
 * Usage: node scripts/bulk-upload-receipts.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads');
const MAPPING_FILE = '/tmp/receipt_mapping.json';

// DB config
const DB_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'tkd_user',
  password: 'tkd_pass_2026',
  database: 'taekwondo',
  charset: 'utf8mb4',
};

const EXAM_ID = 3;

// Extract Google Drive file ID from URL
function extractFileId(url) {
  // Format: https://drive.google.com/open?id=FILE_ID
  const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Format: https://drive.google.com/file/d/FILE_ID/view
  const match2 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  return null;
}

// Download file from Google Drive with retry
async function downloadFromDrive(fileId, retries = 3) {
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      clearTimeout(timeout);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await res.arrayBuffer());
      
      // Check if we got an HTML page (virus scan warning) instead of image
      if (contentType.includes('text/html') && buffer.length < 50000) {
        // Try confirm download URL for large files
        const html = buffer.toString('utf-8');
        const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
        if (confirmMatch) {
          const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}`;
          const res2 = await fetch(confirmUrl, {
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          if (res2.ok) {
            const ct2 = res2.headers.get('content-type') || 'image/jpeg';
            const buf2 = Buffer.from(await res2.arrayBuffer());
            return { data: buf2, contentType: ct2 };
          }
        }
        // If still HTML, it might be a permissions issue or the file is actually small
        // Check if there's a downloadable content anyway
        if (buffer.length > 1000) {
          // Might be a valid file with wrong content-type header
          return { data: buffer, contentType: 'image/jpeg' };
        }
        throw new Error('Got HTML instead of image (possible permissions issue)');
      }
      
      return { data: buffer, contentType };
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`  Retry ${attempt}/${retries} for ${fileId}: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

// Determine file extension from content type
function getExtension(contentType) {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('gif')) return '.gif';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('pdf')) return '.pdf';
  if (contentType.includes('heic')) return '.heic';
  return '.jpg'; // default
}

// Save file to local storage (mirrors storagePut local fallback)
function saveToLocalStorage(relKey, data, contentType) {
  const filePath = path.join(UPLOADS_DIR, relKey);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, data);
  fs.writeFileSync(filePath + '.meta', JSON.stringify({ contentType }));
  return { key: relKey, url: `/api/receipts/${relKey}` };
}

async function main() {
  console.log('=== Bulk Receipt Upload Script ===\n');
  
  // 1. Read mapping
  const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
  const withReceipts = mapping.filter(m => m.has_receipt && m.receipt_url);
  console.log(`Total mappings: ${mapping.length}`);
  console.log(`With receipts: ${withReceipts.length}\n`);
  
  // 2. Connect to DB
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('Connected to database.\n');
  
  // 3. Get all confirmed exam payments for exam 3
  const [payments] = await conn.execute(
    'SELECT id, student_name, receipt_url, receipt_key FROM exam_payments WHERE exam_id = ? AND status = ? AND amount > 0',
    [EXAM_ID, 'confirmed']
  );
  console.log(`Confirmed exam payments (amount > 0): ${payments.length}\n`);
  
  // Build name → payment mapping
  const nameToPayment = new Map();
  for (const p of payments) {
    nameToPayment.set(p.student_name, p);
  }
  
  // 4. Process each receipt
  const results = {
    success: [],
    noMatch: [],
    downloadFailed: [],
    alreadyHasReceipt: [],
  };
  
  for (let i = 0; i < withReceipts.length; i++) {
    const entry = withReceipts[i];
    const { cn_name, receipt_url } = entry;
    const progress = `[${i + 1}/${withReceipts.length}]`;
    
    // Find matching payment
    const payment = nameToPayment.get(cn_name);
    if (!payment) {
      console.log(`${progress} ⚠️  No match: ${cn_name}`);
      results.noMatch.push(cn_name);
      continue;
    }
    
    // Skip if already has receipt
    if (payment.receipt_url) {
      console.log(`${progress} ⏭️  Already has receipt: ${cn_name} (payment #${payment.id})`);
      results.alreadyHasReceipt.push(cn_name);
      continue;
    }
    
    // Extract file ID
    const fileId = extractFileId(receipt_url);
    if (!fileId) {
      console.log(`${progress} ❌ Invalid URL for ${cn_name}: ${receipt_url}`);
      results.downloadFailed.push({ name: cn_name, error: 'Invalid URL' });
      continue;
    }
    
    // Download
    try {
      process.stdout.write(`${progress} ⬇️  ${cn_name}...`);
      const { data, contentType } = await downloadFromDrive(fileId);
      const ext = getExtension(contentType);
      const timestamp = Date.now();
      const relKey = `receipts/exam-${EXAM_ID}/${payment.id}-${timestamp}${ext}`;
      
      // Save to local storage
      const { key, url } = saveToLocalStorage(relKey, data, contentType);
      
      // Update exam_payments
      await conn.execute(
        'UPDATE exam_payments SET receipt_url = ?, receipt_key = ? WHERE id = ?',
        [url, key, payment.id]
      );
      
      // Update accounting_records if linked
      const [accRows] = await conn.execute(
        'UPDATE accounting_records SET receipt_url = ?, receipt_key = ? WHERE exam_payment_id = ?',
        [url, key, payment.id]
      );
      
      const sizeKB = (data.length / 1024).toFixed(1);
      console.log(` ✅ ${sizeKB}KB → ${key} (acc: ${accRows.affectedRows} rows)`);
      results.success.push({ name: cn_name, paymentId: payment.id, key, size: data.length });
      
      // Small delay to be nice to Google
      if (i < withReceipts.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      console.log(` ❌ ${err.message}`);
      results.downloadFailed.push({ name: cn_name, error: err.message });
    }
  }
  
  // 5. Summary
  console.log('\n=== Summary ===');
  console.log(`✅ Success: ${results.success.length}`);
  console.log(`⚠️  No DB match: ${results.noMatch.length}`);
  if (results.noMatch.length > 0) {
    console.log(`   Names: ${results.noMatch.join(', ')}`);
  }
  console.log(`❌ Download failed: ${results.downloadFailed.length}`);
  if (results.downloadFailed.length > 0) {
    for (const f of results.downloadFailed) {
      console.log(`   ${f.name}: ${f.error}`);
    }
  }
  console.log(`⏭️  Already had receipt: ${results.alreadyHasReceipt.length}`);
  
  const totalBytes = results.success.reduce((sum, s) => sum + s.size, 0);
  console.log(`\nTotal uploaded: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  
  await conn.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
