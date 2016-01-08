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
var sender={};

// Routing

app.use(express.static(__dirname + '/public'));

app.get("/user/*",function(req, res){
  var queryString = 'SELECT * FROM users WHERE username="'+req.url+'"';
  console.log("[MySQL] "+queryString);
  db.query(queryString,function(err, rows, fields) {
      if (err){
        res.sendFile(__dirname + '/404/index.html');
      }
      if (rows==0){
        res.sendFile(__dirname + '/404/index.html');
      }else{
        receiver=rows[0];
        res.sendFile(__dirname + '/public/index.html');
      }
  });
});


io.on('connection', function (socket) {

  var addedUser = false;
  if(typeof receiver.username != 'undefined'){

    console.log("receiver.username="+receiver.username);

    socket.emit('send receiver',receiver);

    socket.on('backup messages', function (receiver){
      var queryString = 'SELECT * FROM messages WHERE owner="'+sender.username+'" and (sender="'+receiver.username+'" or receiver="'+receiver.username+'")';
      console.log("[MySQL] "+queryString);
      db.query(queryString,function(err, rows, fields) {
          if (err) throw err;
          if (rows!=0){
            socket.emit('backup messages', rows);
          }
      });
    });

    socket.on('login', function (username){
      console.log("[socket.on] login");

      var queryString = 'SELECT * FROM users WHERE username="'+username+'"';
      console.log("[MySQL] "+queryString);
      db.query(queryString, function(err, rows, fields) {
          if (err) {
            console.log("[socket.emit] login error");
            socket.emit('login_error',1);
          }
          if (rows==0){
            console.log("[socket.emit] login error");
            socket.emit('login_error',1);
          }else{
            sender.username = username;
            addedUser = true;

            var queryString = 'INSERT INTO sockets SET socketid="'+socket.id+'", sender="'+sender.username+'", receiver="'+receiver.username+'"';
            console.log("[MySQL] "+queryString);
            db.query(queryString,function(err) {
                if (err) throw err;
            });

            console.log("[socket.emit] logged");
            socket.emit('logged');

            socket.broadcast.emit('user joined', {
              username: socket.username,
              socketid: socket.id
            });
          }
      });
    });

    socket.on('new message', function (data) {

      var message ={
        owner:sender.username,
        sender:sender.username,
        receiver:receiver.username,
        type:"chat",
        body:data,
        unread:"0"
      };

      db.query('INSERT INTO messages SET ?', message, function(err,res){
        if(err) throw err;
      });

      var message ={
        owner:receiver.username,
        sender:sender.username,
        receiver:receiver.username,
        type:"chat",
        body:data,
        unread:"1"
      };

      db.query('INSERT INTO messages SET ?', message, function(err,res){
        if(err) throw err;
      });

      var queryString = 'SELECT * FROM sockets WHERE (sender="'+receiver.username+'" and receiver="'+sender.username+'") or (sender="'+sender.username+'" and receiver="'+receiver.username+'" and socketid<>"'+socket.id+'")';
      console.log("[MySQL] "+queryString);
      db.query(queryString,function(err, rows, fields) {
          if (err) throw err;
          for (var i = 0; i < rows.length; i++) {
            socket.to(rows[i].socketid).emit('new message',  {
              sender: sender.username,
              body: data
            });
          }
      });
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', function () {
      var queryString = 'SELECT * FROM sockets WHERE (sender="'+receiver.username+'" and receiver="'+sender.username+'") or (sender="'+sender.username+'" and receiver="'+receiver.username+'" and socketid<>"'+socket.id+'")';
      console.log("[MySQL] "+queryString);
      db.query(queryString,function(err, rows, fields) {
          if (err) throw err;
          for (var i = 0; i < rows.length; i++) {
            socket.to(rows[i].socketid).emit('typing', {
              sender: sender.username
            });
          }
      });
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop typing', function () {
      var queryString = 'SELECT * FROM sockets WHERE (sender="'+receiver.username+'" and receiver="'+sender.username+'") or (sender="'+sender.username+'" and receiver="'+receiver.username+'" and socketid<>"'+socket.id+'")';
      console.log("[MySQL] "+queryString);
      db.query(queryString,function(err, rows, fields) {
          if (err) throw err;
          for (var i = 0; i < rows.length; i++) {
            socket.to(rows[i].socketid).emit('stop typing', {
              sender: sender.username
            });
          }
      });
    });

    // when the user disconnects.. perform this
    socket.on('disconnect', function () {
      if (addedUser) {

        console.log("Socket disconnect "+socket.id);

        var queryString = 'DELETE FROM sockets WHERE socketid="'+socket.id+'" and sender="'+sender.username+'" and receiver="'+receiver.username+'"';
        console.log("[MySQL] "+queryString);
        db.query(queryString,function(err) {
            if (err) throw err;
        });

      }
    });
  }
});
