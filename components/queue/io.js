var queue = require('./queue');
var auth = require('../../auth');

module.exports = function(io) {

  // make sure that this endpoint is protected
  io.use(auth.ioIsAuthenticated);

  // on client connection, join appropriate room, and
  // handle subsequent client -> server communications
  io.on('connection', function(socket) {
    var userid = socket.request.user.id;
    if (socket.request.user.role === 'ca') {
      socket.join('ca');
      oncajoin(socket, userid);
    } else if (socket.request.user.role === 'student') {
      socket.join('student');
      socket.join('student_' + socket.request.user.id);
      onstudentjoin(socket, userid);
    } else {
      throw new Error('Not authorized');
    }
  });

  // ca/student global rooms
  var cas = io.to('ca');
  var students = io.to('student');
  var student = function(userid) {
    return io.to('student_' + userid);
  };


  //
  // CA handling
  //

  // individual cas
  var oncajoin = function(socket, userid) {

    // listen for events
    socket.on('freeze_question', function() {

    });

    socket.on('kick_question', function() {

    });

    socket.on('finish_question', function() {

    });

    socket.on('answer_question', function() {

    });
    
    socket.on('close_queue', function() {
      queue.meta.close();
    });

    socket.on('open_queue', function() {
      queue.meta.open();
    });

    socket.on('update_minute_rule', function(minutes) {
      queue.meta.setTimeLimit(minutes);
    });

    // emit the current data on connect
    queue.meta.getCurrent().then(function(meta) {
      socket.emit('queue_meta', makeMessage('update', meta));
    });

  };

  // server -> client
  (function() {
    queue.meta.emitter.on('update', function(meta) {
      cas.emit('queue_meta', makeMessage('update', meta));
    });
  })();


  //
  // Student handling
  //

  // individual students
  var onstudentjoin = function(socket, userid) {

    socket.on('add_question', function(question) {
      question.student_user_id = userid;
      try {
        queue.questions.add(question);
      } catch(error) {
        console.log(error);
      }
    });

    socket.on('update_question', function(question) {
      try {
        queue.questions.update(userid, question);
      } catch (error) {
        console.log(error);
      }
    });

    socket.on('delete_question', function() {
      queue.questions.close(userid, socket.request.user.role);
    });

    socket.on('freeze_question', function() {
      queue.questions.freeze(userid);
    });

    // emit the current data on connect
    queue.meta.getCurrent().then(function(meta) {
      socket.emit('queue_meta', makeMessage('insert', [{
        id: 0,
        open: meta.open
      }]));
    });

    queue.questions.getOpenUserId(userid).then(function(question) {
      if (typeof question === 'undefined') {
        return;
      }

      socket.emit('questions', makeMessage('insert', [{
        id: question.id,
        topic_id: question.topic_id,
        location_id: question.location_id,
        help_text: question.help_text,
        queue_ps: parseInt(question.queue_position),
        is_frozen: question.is_frozen,
        can_freeze: question.frozen_time === null
      }]));

    });

    queue.locations.getEnabled().then(function(locations) {
      socket.emit('locations', makeMessage('insert', locations));
    });

    queue.topics.getEnabled().then(function(topics) {
      socket.emit('topics', makeMessage('insert', topics));
    });

  };

  // server -> client
  (function() {

    // listen for updates on queue_meta
    queue.meta.emitter.on('update', function(meta) {
      students.emit('queue_meta', makeMessage('update', [{
        open: meta.open
      }]));
    });



  })();

  //
  // utilities
  //
  var makeMessage = function(type, payload) {
    return {
      type: type,
      payload: payload
    };
  };

};
