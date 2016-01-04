// Setup basic express server
var express = require('express');

var app = express();

var server = require('http').createServer(app);
var io = require('socket.io')(server);

var port = process.env.PORT || 8888;

var mysql      = require('mysql');
var db = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'C1t10us@MySql-1',
  database : 'node'
});

db.connect();

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

var queryString = 'DELETE FROM sockets WHERE 1';
console.log("[MySQL] "+queryString);
db.query(queryString,function(err) {
    if (err) throw err;
});


//
var receiver={};

// Routing

app.use(express.static(__dirname + '/public'));

app.get("/user/*",function(req, res){
  receiver.username=req.url;
  res.sendFile(__dirname + '/public/index.html');
});

// Chatroom
var numUsers = 0;
var users = {};
var socketids = {};


io.on('connection', function (socket) {



  var addedUser = false;
  if(typeof receiver.username != 'undefined'){
    console.log("receiver.username="+receiver.username);

    var queryString = 'SELECT * FROM users WHERE username="'+receiver.username+'"';
    console.log("[MySQL] "+queryString);
    db.query(queryString,function(err, rows, fields) {
        if (err) throw err;
        if (rows==0){
          res.sendFile(__dirname + '/404/index.html');
        }else{
          socket.receiver=rows[0].username;
          socket.header=rows[0].header;
          socket.emit('user header',socket.header);
        }
    });

    socket.on('login', function (username){

      var queryString = 'SELECT * FROM users WHERE username="'+username+'"';
      console.log("[MySQL] "+queryString);
      db.query(queryString, function(err, rows, fields) {
          if (err) throw err;
          if (rows==0){
            socket.emit('login error');
          }else{
            socket.sender = username;
            users[socket.id]=username;
            ++numUsers;
            addedUser = true;

            var queryString = 'INSERT INTO sockets SET socketid="'+socket.id+'", sender="'+socket.sender+'", receiver="'+socket.receiver+'"';
            console.log("[MySQL] "+queryString);
            db.query(queryString,function(err) {
                if (err) throw err;
            });


            var queryString = 'SELECT * FROM messages WHERE owner="'+socket.sender+'" and (sender="'+socket.receiver+'" or receiver="'+socket.receiver+'")';
            console.log("[MySQL] "+queryString);
            db.query(queryString,function(err, rows, fields) {
                if (err) throw err;
                if (rows!=0){
                  socket.emit('messages backup', rows);
                }
            });

            socket.emit('logged', users);

            socket.broadcast.emit('user joined', {
              username: socket.username,
              socketid: socket.id
            });
          }
      });
    });

    // when the client emits 'new message', this listens and executes
    socket.on('new message', function (data) {

      var message ={
        owner:socket.sender,
        sender:socket.sender,
        receiver:socket.receiver,
        type:"chat",
        body:data,
        unread:"0"
      };

      db.query('INSERT INTO messages SET ?', message, function(err,res){
        if(err) throw err;
      });

      var message ={
        owner:socket.receiver,
        sender:socket.sender,
        receiver:socket.receiver,
        type:"chat",
        body:data,
        unread:"1"
      };

      db.query('INSERT INTO messages SET ?', message, function(err,res){
        if(err) throw err;
      });

      var queryString = 'SELECT * FROM sockets WHERE (sender="'+socket.receiver+'" and receiver="'+socket.sender+'") or (sender="'+socket.sender+'" and receiver="'+socket.receiver+'" and socketid<>"'+socket.id+'")';
      console.log("[MySQL] "+queryString);
      db.query(queryString,function(err, rows, fields) {
          if (err) throw err;
          for (var i = 0; i < rows.length; i++) {
            socket.to(rows[i].socketid).emit('new message',  {
              sender: rows[i].sender,
              body: data
            });
          }
      });
    });

    // when the client emits 'add user', this listens and executes
    socket.on('add user', function (username) {
      if (addedUser) return;

      // we store the username in the socket session for this client
      socket.username = username;

      users[socket.id]=socket.username;



      ++numUsers;
      addedUser = true;
      socket.emit('login', users);

      socket.broadcast.emit('user joined', {
        username: socket.username,
        socketid: socket.id
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

        console.log("Socket disconnect "+socket.id);

        var queryString = 'DELETE FROM sockets WHERE sender="'+socket.sender+'" and receiver="'+socket.receiver+'"';
        console.log("[MySQL] "+queryString);
        db.query(queryString,function(err) {
            if (err) throw err;
        });

        delete users[socket.id]
        // echo globally that this client has left
        socket.broadcast.emit('user left', {
          username: socket.username,
          socketid: socket.id
        });
      }
    });
  }
});
