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

//
var receiver={};

// Routing

app.use(express.static(__dirname + '/public'));

app.get("/user/*",function(req, res){
  receiver.sender=req.url;
  res.sendFile(__dirname + '/public/index.html');
});

// Chatroom
var numUsers = 0;
var users = {};


io.on('connection', function (socket) {
  var addedUser = false;
  if(typeof receiver.sender != 'undefined'){
    console.log("receiver.sender="+receiver.sender);

    var queryString = 'SELECT * FROM users WHERE sender="'+receiver.sender+'"';
    console.log("[MySQL] "+queryString);
    db.query(queryString,function(err, rows, fields) {
        if (err) throw err;
        if (rows==0){
          res.sendFile(__dirname + '/404/index.html');
        }else{
          socket.receiver=rows[0].sender;
          socket.header=rows[0].header;
          socket.emit('user header',socket.header);
        }
    });
    socket.on('login', function (sender){

      var queryString = 'SELECT * FROM users WHERE sender="/user/'+sender+'"';
      console.log("[MySQL] "+queryString);
      db.query(queryString, function(err, rows, fields) {
          if (err) throw err;
          if (rows==0){
            socket.emit('login error');
          }else{
            socket.sender = '/user/'+sender;
            users[socket.id]=sender;
            ++numUsers;
            addedUser = true;


            socket.emit('logged', users);

            socket.broadcast.emit('user joined', {
              sender: socket.sender,
              socketid: socket.id
            });
          }
      });
    });

    socket.on('list messages', function(){
      var queryString = 'SELECT * FROM messages WHERE owner="'+socket.sender+'" and (sender="'+socket.receiver+'" or receiver="'+socket.receiver+'")';
      console.log("[MySQL] "+queryString);
      db.query(queryString,function(err, rows, fields) {
          if (err) throw err;
          if (rows!=0){
            console.log("[emit] messages backup");
            socket.emit('list messages', rows);
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


      // we tell the client to execute 'new message'
      socket.broadcast.emit('new message', {
        sender: socket.sender,
        body: data
      });
    });

    // when the client emits 'add user', this listens and executes
    socket.on('add user', function (sender) {
      if (addedUser) return;

      // we store the sender in the socket session for this client
      socket.sender = sender;

      users[socket.id]=socket.sender;



      ++numUsers;
      addedUser = true;
      socket.emit('login', users);

      socket.broadcast.emit('user joined', {
        sender: socket.sender,
        socketid: socket.id
      });
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', function () {
      socket.broadcast.emit('typing', {
        sender: socket.sender
      });
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop typing', function () {
      socket.broadcast.emit('stop typing', {
        sender: socket.sender
      });
    });

    // when the user disconnects.. perform this
    socket.on('disconnect', function () {
      if (addedUser) {
        --numUsers;

        console.log("Socket disconnect "+socket.id);

        delete users[socket.id]
        // echo globally that this client has left
        socket.broadcast.emit('user left', {
          sender: socket.sender,
          socketid: socket.id
        });
      }
    });
  }
});
