// Setup basic express server
var mysql = require('mysql');
var db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password : 'C1t10us@MySql-1',
    database: 'node'
})
var express = require('express');
var app = express();

var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 8888;

// Log any errors connected to the db
db.connect(function(err){
    if (err) console.log(err)
})

// Define/initialize our global vars
var notes = []
var isInitNotes = false
var socketCount = 0


server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom

var numUsers = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {

    Date.now = function() { return new Date().getTime(); }
    var message = {
      owner:socket.username,
      sender:socket.username,
      receiver:"brand.abanca",
      type:"chat",
      lang:"en",
      body:data,
      unread:"1",
      created:Date.now
    };
    db.query('INSERT INTO messages SET ?', message);
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
