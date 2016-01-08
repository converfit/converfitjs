$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $header = $('.header');
  var $headerTitle = $('header-title');
  var $usernameInput = $('.phone'); // Input for username


  var $signupForm = $('.signup-form');
  var $signupButton = $('.signup-form .submit');

  var $conversation = $('#conversation'); // Messages area
  var $content=$('.content');
  var $inputMessage = $('#inputMessage'); // Input message input box
  var $addMessageForm = $('#add_message');
  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  var username;
  var receiver={};

  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();



  function play_beep(){
    $(".audioBeep").trigger('play');
  }


  if (typeof localStorage["username"] != 'undefined'){
    login(localStorage["username"]);
  }

  $signupForm.submit(function(e){
    e.preventDefault();
    username = cleanInput($usernameInput.val().trim());
    if(username){
      login(username);
    }
  });

  $addMessageForm.submit(function(e){
    e.preventDefault();
    message = cleanInput($inputMessage.val().trim());
    if(message){
      $inputMessage.val('');
      console.error("[socket emit] stop typing");
      socket.emit('stop typing');
      typing = false;

      sendMessage(message);
    }
  });

  $signupButton.click(function(){
    $signupForm.submit();
  });

  function login (data) {
    username="/user/"+data;
    console.error('[socket emit] login');
    socket.emit('login',username);
  }

  socket.on('send receiver',function(data){
    console.error('[send receiver] '+data);
    receiver=data;

  });

  // Sends a chat message
  function sendMessage (message) {

    // if there is a non-empty message and a socket connection
    if (message && connected) {
      addChatMessage({
        sender: username,
        receiver: receiver.username,
        body: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('add message', message);
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, type, options) {

    message='';
    if(data.sender==username){
      block_class="messages-block-me";
    }else{
      var $typingMessages = getTypingMessages(data);
      options = options || {};
      if ($typingMessages.length !== 0) {
        options.fade = false;
        $typingMessages.remove();
      }

      block_class="messages-block-them";

    }
    if(type=="typing"){
      block_class+=" typing";
    }
    message+='<div class="'+block_class+'" style="">';

    message+='  <div class="message">';
    message+='    <p class="bubble">'+data.body+'</p>';
    message+='    <div class="clearfix"></div>';
    message+='    <p class="time">'+typeof data.created+' </p>';
    message+='  </div>';
    message+='  <div class="clearfix"></div>';
    message+='</div>';

    addMessageElement(message, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.body = '<img class="typing" src="http://www.converfit.com/node-server/public/assets/img/typing.gif" style="width:25px;"/>';
    addChatMessage(data,"typing");
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $conversation.prepend($el);
    } else {
      $conversation.append($el);
    }
    $content[0].scrollTop=$content[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        console.error("[socket emit] typing");
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          console.error("[socket emit] stop typing");
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing');
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // Keyboard events

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('logged', function (data) {
    connected = true;
    $loginPage.fadeOut();
    $chatPage.fadeIn();
    socket.emit('backup messages',receiver)
  });

  socket.on('login_error', function (data) {
    console.error("[socket.on] login error");
    localStorage.removeItem("username");
    username=false;
  });


  socket.on('backup messages',function (data){
    $.each(data, function(index, message){
      addChatMessage(message);
    });
  });


  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
    play_beep();
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });
});
