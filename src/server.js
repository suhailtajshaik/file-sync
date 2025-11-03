const config = require("../config/index");
const watch = require("node-watch");
const fetch = require("node-fetch");
const nodePath = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const FormData = require("form-data");

const upload = multer({ dest: "uploads/" });
const app = express();
app.use(express.json());

const SYNC_FROM_DIR = config.SYNC_FROM_DIR;
const SYNC_TO_DIR = config.SYNC_TO_DIR;

// Tracking and statistics
const syncStats = {
  totalSynced: 0,
  totalErrors: 0,
  lastSync: null,
  status: 'running'
};

// Debouncing: track pending file operations
const pendingOperations = new Map();
const DEBOUNCE_DELAY = 500; // ms

/**
 * Create folder recursively
 */
const createFolder = (folderName) => {
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName, { recursive: true });
  }
};

/**
 * Calculate file checksum for integrity verification
 */
const calculateChecksum = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

/**
 * Get relative path from watched directory
 */
const getRelativePath = (fullPath, baseDir) => {
  return nodePath.relative(baseDir, fullPath);
};

/**
 * Retry mechanism with exponential backoff
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[RETRY] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Log with timestamp
 */
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`, data);
};

/**
 * Sync file to remote server
 */
const syncFile = async (filePath, relativePath) => {
  try {
    log('INFO', `Syncing file: ${relativePath}`);

    // Check if file still exists (might have been deleted during debounce)
    if (!fs.existsSync(filePath)) {
      log('WARN', `File no longer exists: ${relativePath}`);
      return;
    }

    // Check if it's a directory
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      log('INFO', `Skipping directory: ${relativePath}`);
      return;
    }

    // Calculate checksum
    const checksum = await calculateChecksum(filePath);

    // Upload with retry
    await retryWithBackoff(async () => {
      const file = fs.createReadStream(filePath);
      const form = new FormData();
      form.append("file", file);
      form.append("relativePath", relativePath);
      form.append("checksum", checksum);

      const response = await fetch(`${config.REMOTE_URL}/files`, {
        method: "POST",
        body: form,
        timeout: 30000 // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      return response.json();
    });

    syncStats.totalSynced++;
    syncStats.lastSync = new Date().toISOString();
    log('SUCCESS', `File synced successfully: ${relativePath}`);

  } catch (error) {
    syncStats.totalErrors++;
    log('ERROR', `Failed to sync file: ${relativePath}`, { error: error.message });
    throw error;
  }
};

/**
 * Debounced file change handler
 */
const handleFileChange = (evt, filePath) => {
  const relativePath = getRelativePath(filePath, SYNC_FROM_DIR);

  log('INFO', `File ${evt}: ${relativePath}`);

  // Clear existing timeout for this file
  if (pendingOperations.has(filePath)) {
    clearTimeout(pendingOperations.get(filePath));
  }

  // Set new timeout
  const timeoutId = setTimeout(async () => {
    pendingOperations.delete(filePath);

    try {
      if (evt === 'update' || evt === 'create') {
        await syncFile(filePath, relativePath);
      } else if (evt === 'remove') {
        // Handle file deletion if needed
        log('INFO', `File removed: ${relativePath}`);
      }
    } catch (error) {
      log('ERROR', `Error handling file change: ${relativePath}`, { error: error.message });
    }
  }, DEBOUNCE_DELAY);

  pendingOperations.set(filePath, timeoutId);
};

// Initialize directories
createFolder(SYNC_FROM_DIR);
createFolder(SYNC_TO_DIR);

// Watch directory with recursive enabled
log('INFO', `Starting file watcher on: ${SYNC_FROM_DIR}`);
watch(SYNC_FROM_DIR, { recursive: true }, handleFileChange);

/**
 * Endpoint to receive files
 */
app.post("/files", upload.single("file"), async function (req, res, next) {
  try {
    const { originalname, path: tempPath } = req.file;
    const relativePath = req.body.relativePath || originalname;
    const receivedChecksum = req.body.checksum;

    log('INFO', `Receiving file: ${relativePath}`);

    // Verify checksum if provided
    if (receivedChecksum) {
      const actualChecksum = await calculateChecksum(tempPath);
      if (actualChecksum !== receivedChecksum) {
        log('ERROR', `Checksum mismatch for: ${relativePath}`);
        fs.unlinkSync(tempPath);
        return res.status(400).json({
          success: false,
          error: 'Checksum verification failed'
        });
      }
    }

    // Create destination directory if needed
    const destPath = nodePath.join(SYNC_TO_DIR, relativePath);
    const destDir = nodePath.dirname(destPath);
    createFolder(destDir);

    // Move file to destination
    const file = fs.readFileSync(tempPath);
    fs.writeFileSync(destPath, file);
    fs.unlinkSync(tempPath);

    log('SUCCESS', `File received and saved: ${relativePath}`);

    res.status(200).json({
      success: true,
      message: 'File synced successfully',
      path: relativePath
    });
  } catch (error) {
    log('ERROR', 'Error receiving file', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: syncStats.status,
    uptime: process.uptime(),
    syncStats: syncStats,
    pendingOperations: pendingOperations.size
  });
});

/**
 * Status endpoint
 */
app.get("/status", (req, res) => {
  res.json({
    syncFromDir: SYNC_FROM_DIR,
    syncToDir: SYNC_TO_DIR,
    stats: syncStats,
    pendingOperations: pendingOperations.size
  });
});

// Start server
app.listen(config.PORT, () => {
  log('INFO', `File sync server started on port ${config.PORT}`);
  log('INFO', `Watching: ${SYNC_FROM_DIR}`);
  log('INFO', `Syncing to: ${SYNC_TO_DIR}`);
});
