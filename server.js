'use strict';



const fs = require('fs');

const http = require('http');

const https = require('https');

const express = require('express');



const WebSocket = require('ws');



const PORT = process.env.PORT || 4443;

const INDEX = '/index.html';



const app = express();



// Certificate

const privateKey = fs.readFileSync('./server.key', 'utf8');

const certificate = fs.readFileSync('./server.cert', 'utf8');



const credentials = {

        key: privateKey,

        cert: certificate,

};



var nextRoom = 1000;



var roomToWebSockets = new Map();



const httpServer = http.createServer(app);

const httpsServer = https.createServer(credentials, app);



app.get('/', function(req, res){ 

  if (!req.secure)

    res.redirect("https://" + req.headers.host + req.url);

  else

    res.sendFile(__dirname + '/index.html');

});



app.get('/r/:roomId', function(req, res){ 

  if (!req.secure)

    res.redirect("https://" + req.headers.host + req.url);

  else

    res.sendFile(__dirname + '/index.html');

});







app.use(express.static('public'));



httpServer.listen(8000, () => {

    console.log('HTTP Server running on port 8080');

});



httpsServer.listen(4443, () => {

    console.log('HTTPS Server running on port 4443');

});



//const server = express()

//  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))

//  .listen(PORT, () => console.log(`Listening on ${PORT}`));



const wss = new WebSocket.Server({ server: httpsServer });



wss.on('connection', (ws) => {

  console.log('Client connected');

  ws.on('close', function onClose() { onWebSocketClose(ws); });

  ws.on('message', function onMessage(message) { onWebSocketMessage(ws, message); });

});



function onWebSocketMessage(ws, message) {

   console.log('onWebSocketMessage:' + message + "\n");

   var msg = JSON.parse(message);

   switch(msg.msg_type) {

     case 'get_room':

         var websockets = [];

         ws.room = nextRoom;

         websockets.push(ws);

         roomToWebSockets.set(nextRoom, websockets);

         var response = {msg_type : 'get_room',

             room_number : nextRoom};

         nextRoom++;

         ws.send(JSON.stringify(response));

     break;

     case 'join_room':

         var room = msg.room_number;

         ws.room = room;

         console.log('join room:' + room + ',roomToWebSockets:' + roomToWebSockets);

         var sockets = roomToWebSockets.get(room);

         console.log('sockets:' + sockets);

         sockets[0].peer = ws;

         ws.peer = sockets[0];

         sockets.push(ws);

     break;

     case 'message':

         var room = msg.room_number;

         var peerSocket = ws.peer;

        if (peerSocket)

             peerSocket.send(message);

         else

             console.log('Can not get peer');

     break;

     case 'webrtc':

         //var room = msg.room_number;

         var peerSocket = ws.peer;

         if (peerSocket)

             peerSocket.send(message);

         else

             console.log('Can not get peer');

     break;

   }

}



function onWebSocketClose(ws) {

    var room = ws.room;

    console.log('onWebSocketClose-room:' + room);

    roomToWebSockets.delete(room);

}



//setInterval(() => {

//  wss.clients.forEach((client) => {

//    client.send(new Date().toTimeString());

//  });

//}, 1000);
