const http = require('http');
const fs = require('fs');
const path = require('path');

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // No salir del proceso, solo loguear el error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // No salir del proceso, solo loguear el error
});

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'docs');

// Verificar que el directorio docs existe
if (!fs.existsSync(PUBLIC_DIR)) {
  console.error(`Error: Directory ${PUBLIC_DIR} does not exist`);
  process.exit(1);
}

// Verificar que index.html existe
const indexPath = path.join(PUBLIC_DIR, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error(`Error: ${indexPath} does not exist. Please run 'npm run build:coolify' first.`);
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

const server = http.createServer((req, res) => {
  try {
    // Limpiar la URL (remover query strings y fragmentos)
    const urlPath = req.url.split('?')[0].split('#')[0];
    let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
    
    // Prevenir directory traversal
    const resolvedPath = path.resolve(filePath);
    const resolvedPublic = path.resolve(PUBLIC_DIR);
    if (!resolvedPath.startsWith(resolvedPublic)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    // Si es una ruta de SPA (sin extensión y no es un asset), servir index.html
    const ext = path.extname(filePath);
    if (!ext && !urlPath.startsWith('/assets/')) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const extname = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // Si no se encuentra, servir index.html para SPA
          fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err, content) => {
            if (err) {
              console.error('Error loading index.html:', err);
              res.writeHead(500);
              res.end('Error loading index.html');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(content, 'utf-8');
            }
          });
        } else {
          console.error('Error reading file:', err);
          res.writeHead(500);
          res.end(`Server Error: ${err.code}`);
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
  process.exit(1);
});

try {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Serving files from: ${PUBLIC_DIR}`);
    console.log('Server started successfully');
  });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}

// Manejar señales de terminación
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Keep the process alive
setInterval(() => {
  // Heartbeat para mantener el proceso vivo
}, 30000);

