# Real-Time File Sync

A robust, real-time file synchronization system with advanced features for reliable file syncing between directories.

## Features

### Core Improvements

1. **Recursive Directory Watching**
   - Watches all subdirectories, not just the top-level folder
   - Automatically handles nested folder structures

2. **Non-Destructive Syncing**
   - Source files are preserved (no deletion after sync)
   - True synchronization behavior

3. **File Integrity Verification**
   - SHA-256 checksum calculation for all files
   - Automatic verification on receive
   - Corrupted file detection

4. **Intelligent Debouncing**
   - Handles rapid file changes gracefully
   - 500ms debounce delay to prevent duplicate syncs
   - Tracks pending operations

5. **Robust Error Handling**
   - Exponential backoff retry mechanism (3 retries)
   - Network failure recovery
   - Detailed error logging

6. **Event-Based File Handling**
   - Distinguishes between create, update, and delete operations
   - Smart handling of each event type

7. **Enhanced Logging**
   - Timestamp-based logging
   - Log levels: INFO, WARN, ERROR, SUCCESS
   - Structured log data

8. **Monitoring Endpoints**
   - `/health` - Health check and uptime
   - `/status` - Sync statistics and current state

9. **Sync Statistics**
   - Total files synced
   - Total errors
   - Last sync timestamp
   - Pending operations count

## Installation

```bash
npm install
```

## Configuration

Edit `.env` file:

```env
SYNC_FROM_DIR=./syncFrom
SYNC_TO_DIR=./syncTo
PORT=3000
REMOTE_URL=http://localhost:3000
```

## Usage

Start the sync server:

```bash
npm start
```

## API Endpoints

### POST /files
Upload a file for syncing

**Request:**
- Form data with file
- `relativePath`: Relative path from base directory
- `checksum`: SHA-256 checksum for verification

**Response:**
```json
{
  "success": true,
  "message": "File synced successfully",
  "path": "relative/path/to/file.txt"
}
```

### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "running",
  "uptime": 12345.67,
  "syncStats": {
    "totalSynced": 42,
    "totalErrors": 0,
    "lastSync": "2025-11-03T12:34:56.789Z",
    "status": "running"
  },
  "pendingOperations": 0
}
```

### GET /status
Detailed status information

**Response:**
```json
{
  "syncFromDir": "./syncFrom",
  "syncToDir": "./syncTo",
  "stats": {
    "totalSynced": 42,
    "totalErrors": 0,
    "lastSync": "2025-11-03T12:34:56.789Z",
    "status": "running"
  },
  "pendingOperations": 0
}
```

## Architecture

```
┌─────────────┐         ┌─────────────┐
│  Watch Dir  │         │  HTTP API   │
│ (SYNC_FROM) │         │             │
└──────┬──────┘         └──────▲──────┘
       │                       │
       │ File Change           │ Upload
       ▼                       │
┌─────────────┐         ┌─────┴──────┐
│  Debouncer  ├────────▶│ Retry      │
│             │         │ Mechanism  │
└─────────────┘         └─────┬──────┘
                              │
                        ┌─────▼──────┐
                        │ Checksum   │
                        │ Verify     │
                        └─────┬──────┘
                              │
                        ┌─────▼──────┐
                        │  Save to   │
                        │ SYNC_TO    │
                        └────────────┘
```

## Key Technical Details

### Debouncing
- Prevents multiple syncs for rapid file changes
- Uses Map to track pending operations per file
- Configurable delay (default: 500ms)

### Retry Mechanism
- Exponential backoff: 1s, 2s, 4s
- Up to 3 retry attempts
- Network error recovery

### Checksum Verification
- SHA-256 hashing
- Stream-based calculation for large files
- Automatic mismatch detection

### Relative Path Handling
- Preserves directory structure
- Automatically creates nested directories
- Handles complex folder hierarchies

## Improvements Over Original

| Feature | Original | Improved |
|---------|----------|----------|
| Recursive watch | ❌ | ✅ |
| File preservation | ❌ | ✅ |
| Error retry | ❌ | ✅ |
| Debouncing | ❌ | ✅ |
| Checksums | ❌ | ✅ |
| Logging | Basic | Advanced |
| Monitoring | ❌ | ✅ |
| Event handling | Single | Multiple |
| Nested folders | ❌ | ✅ |
| Stats tracking | ❌ | ✅ |

## License

ISC

## Author

Suhail Taj Shaik
