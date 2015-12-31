// Setup basic express server
var express = require('express');
var cookieParser = require('cookie-parser');

var app = express();
app.use(cookieParser());

var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 8888;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

/*app.get('/login',function(req, res){
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
app.use("/",express.static(__dirname + '/public'));

app.use(function(req, res) {
    res.send(404, 'Page not found');
});


function handler (req, res) {
  fs.readFile(__dirname + '/public/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}


//Cookies

// Chatroom
var numUsers = 0;
var users = {};


io.on('connection', function (socket) {
  var addedUser = false;

  if(typeof socket.request.headers.cookie.cookie_value == 'undefined'){
    socket.request.headers.cookie.cookie_value=0;
    console.log("Cookie = "+socket.request.headers.cookie.cookie_value)
  }else{
    socket.request.headers.cookie.cookie_value+=1;
    console.log("Cookie = "+socket.request.headers.cookie.cookie_value)
    if(socket.request.headers.cookie.cookie_value==4){
      socket.request.headers.cookie.cookie_value=0;
    }
  }


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
