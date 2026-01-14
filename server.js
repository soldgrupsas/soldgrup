const http = require('http');
const fs = require('fs');
const path = require('path');

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // No salir del proceso, solo loguear el error para mantener el servidor vivo
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // No salir del proceso, solo loguear el error para mantener el servidor vivo
});

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'docs');

// Verificar que el directorio docs existe
console.log(`Checking if directory exists: ${PUBLIC_DIR}`);
if (!fs.existsSync(PUBLIC_DIR)) {
  console.error(`Error: Directory ${PUBLIC_DIR} does not exist`);
  console.error(`Current working directory: ${process.cwd()}`);
  console.error(`__dirname: ${__dirname}`);
  process.exit(1);
}

// Verificar que index.html existe
const indexPath = path.join(PUBLIC_DIR, 'index.html');
console.log(`Checking if index.html exists: ${indexPath}`);
if (!fs.existsSync(indexPath)) {
  console.error(`Error: ${indexPath} does not exist. Please run 'npm run build:coolify' first.`);
  console.error(`Files in ${PUBLIC_DIR}:`, fs.readdirSync(PUBLIC_DIR).join(', '));
  process.exit(1);
}

console.log('All checks passed. Starting server...');

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
  console.error('Error code:', err.code);
  console.error('Error message:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    console.error('Trying to use a different port...');
    // Intentar con otro puerto
    const newPort = PORT + 1;
    server.listen(newPort, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${newPort}`);
      console.log(`Serving files from: ${PUBLIC_DIR}`);
    });
  } else {
    // No salir del proceso para otros errores, solo loguear
    console.error('Server error occurred but keeping process alive');
  }
});

// Función para iniciar el servidor
function startServer() {
  try {
    console.log(`Attempting to start server on port ${PORT}...`);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server running on http://0.0.0.0:${PORT}`);
      console.log(`✓ Serving files from: ${PUBLIC_DIR}`);
      console.log('✓ Server started successfully');
      console.log('✓ Server is ready to accept connections');
    });
    
    // Verificar que el servidor está escuchando después de un breve delay
    setTimeout(() => {
      if (server.listening) {
        console.log('✓ Server is listening and ready');
      } else {
        console.error('✗ Server failed to start listening');
      }
    }, 1000);
  } catch (error) {
    console.error('Failed to start server:', error);
    console.error('Error stack:', error.stack);
    // No salir del proceso, intentar reiniciar después de un delay
    setTimeout(() => {
      console.log('Attempting to restart server...');
      startServer();
    }, 5000);
  }
}

// Iniciar el servidor
startServer();

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

