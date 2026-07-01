const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    // Resolve URL path to local files
    let urlPath = req.url.split('?')[0]; // Strip query strings
    let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 Archivo No Encontrado</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Error interno del servidor: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor CopyRent corriendo en http://localhost:${PORT}/index.html`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`Error: Puerto ${PORT} ocupado. Reintentando en puerto 8080...`);
        server.listen(8080);
    } else {
        console.error('Error al iniciar el servidor:', e);
    }
});
