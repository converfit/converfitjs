// Setup basic express server
var express = require('express');
var cookieParser = require('socket.io-cookie');

var app = express();

var server = require('http').createServer(app);
var io = require('socket.io')(server);
io.use(cookieParser);

var port = process.env.PORT || 8888;

var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'C1t10us@MySql-1',
  database : 'node'
});

connection.connect();

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

/*
app.get('/login',function(req, res){
  if(typeof req.cookies.cookie_name == 'undefined'){
    cookie_value=Math.random();
    res.cookie("cookie_name" , cookie_value);
  }
  res.send("public");

});

app.get('/logout',function(req, res){
  res.clearCookie('cookie_name');
  res.send("Cookie delete: "+req.cookies.cookie_name);
});
*/


// Routing
app.use(express.static(__dirname + '/public'));

app.use(function(req, res) {
  var tmp = req.url.split("?");
  to_username=tmp[0].replace("/","");
  console.log(to_username);

  var queryString = 'SELECT * FROM users WHERE username=?';

  connection.query(queryString, to_username,function(err, rows, fields) {
      if (err) throw err;
      if (rows==0){
        console.log("No brand");
      }else{
        express.static(__dirname + '/public')
      }
  });
});




//Cookies

// Chatroom
var numUsers = 0;
var users = {};


io.on('connection', function (socket) {
  var addedUser = false;


  socket.on('login', function (username){

    console.log("[Login] "+username);
    users[socket.id]=username;
    ++numUsers;
    addedUser = true;
    socket.emit('logged', users);

    socket.broadcast.emit('user joined', {
      username: socket.username,
      socketid: socket.id
    });
  });

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
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

      delete users[socket.id]
      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        socketid: socket.id
      });
    }
  });
});
