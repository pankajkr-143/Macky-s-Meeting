const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server running');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    ws.on('message', message => {
        console.log('received: %s', message);
    });
    ws.send('something');
});

const port = process.env.PORT || 3000; // Heroku provides the PORT environment variable
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
