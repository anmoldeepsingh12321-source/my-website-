const http = require('http');
const fs = require('fs');
const path = require('path');

const config = require('./config.json');

// ============================================================
// FIREBASE ADMIN INITIALIZATION
// Place your downloaded serviceAccountKey.json in this folder
// ============================================================
const admin = require('firebase-admin');

// TODO: Replace the path below with your actual service account key file
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
console.log('✅ Firebase Admin initialized successfully');

// ============================================================
// HELPER: Parse JSON body from request
// ============================================================
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ============================================================
// HELPER: Set CORS headers
// ============================================================
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ============================================================
// API ROUTE: POST /api/complaints — Submit a new complaint
// ============================================================
async function handleSubmitComplaint(req, res) {
  try {
    const data = await parseBody(req);

    // Validate required fields
    const required = ['name', 'contact', 'area', 'street', 'issueType', 'description'];
    for (const field of required) {
      if (!data[field] || String(data[field]).trim() === '') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Missing required field: ${field}` }));
        return;
      }
    }

    if (String(data.contact).length !== 10) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Contact must be 10 digits' }));
      return;
    }

    // Generate unique complaint ID
    const complaintId = 'LW' + Date.now();

    // Save to Firestore
    await db.collection('complaints').doc(complaintId).set({
      complaintId,
      name: data.name.trim(),
      contact: data.contact.trim(),
      area: data.area.trim(),
      street: data.street.trim(),
      issueType: data.issueType.trim(),
      description: data.description.trim(),
      photoUrl: data.photoUrl || null,
      status: 'pending',           // pending | in_progress | resolved
      priority: getPriority(data.issueType),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedAt: null
    });

    console.log(`📋 New complaint filed: ${complaintId} | ${data.issueType} | ${data.area}`);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      complaintId,
      message: 'Complaint submitted successfully. You will be contacted within 24 hours.',
      estimatedResolution: getEstimatedResolution(data.issueType)
    }));

  } catch (err) {
    console.error('Error submitting complaint:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
  }
}

// ============================================================
// API ROUTE: GET /api/complaints/:id — Track complaint status
// ============================================================
async function handleTrackComplaint(req, res, complaintId) {
  try {
    const doc = await db.collection('complaints').doc(complaintId).get();

    if (!doc.exists) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Complaint not found. Please check the ID.' }));
      return;
    }

    const data = doc.data();

    // Return safe public-facing data (no internal fields)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      complaint: {
        complaintId: data.complaintId,
        name: data.name,
        area: data.area,
        issueType: data.issueType,
        description: data.description,
        status: data.status,
        priority: data.priority,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
        updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
        resolvedAt: data.resolvedAt ? data.resolvedAt.toDate().toISOString() : null
      }
    }));

  } catch (err) {
    console.error('Error tracking complaint:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
  }
}

// ============================================================
// HELPER: Assign priority based on issue type
// ============================================================
function getPriority(issueType) {
  const priorities = {
    'contamination': 'critical',
    'no_supply': 'high',
    'leak': 'high',
    'low_pressure': 'medium',
    'meter': 'low'
  };
  return priorities[issueType] || 'medium';
}

// ============================================================
// HELPER: Estimated resolution time
// ============================================================
function getEstimatedResolution(issueType) {
  const times = {
    'contamination': '2 hours',
    'no_supply': '4 hours',
    'leak': '4 hours',
    'low_pressure': '24 hours',
    'meter': '48 hours'
  };
  return times[issueType] || '24 hours';
}

// ============================================================
// MAIN HTTP SERVER
// ============================================================
const server = http.createServer(async (req, res) => {
  setCORSHeaders(res);

  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = url.pathname;

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── API: Submit complaint ──────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/complaints') {
    await handleSubmitComplaint(req, res);
    return;
  }

  // ── API: Track complaint ───────────────────────────────────
  const trackMatch = pathname.match(/^\/api\/complaints\/([A-Z0-9]+)$/i);
  if (req.method === 'GET' && trackMatch) {
    await handleTrackComplaint(req, res, trackMatch[1].toUpperCase());
    return;
  }

  // ── Static file serving ────────────────────────────────────
  if (pathname === '/') {
    pathname = '/3129.html';
  }

  const filePath = path.join(__dirname, pathname);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.ico': 'image/x-icon',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp'
    };

    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(config.port, config.host, () => {
  console.log(`\n🚀 ${config.appName} v${config.version}`);
  console.log(`🌐 Running at: http://localhost:${config.port}`);
  console.log(`📡 API Endpoints:`);
  console.log(`   POST /api/complaints         → Submit new complaint`);
  console.log(`   GET  /api/complaints/:id     → Track complaint status\n`);
});