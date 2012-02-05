/**
 * ircloggr - a node.js all-in-one implementation of irc logging visible via
 *            a REST/JSON interface.
 *
 * See LICENSE file for licensing information.
 */

const mysql = require('mysql'),
       path = require('path'),
     config = require('./config.js'),
         fs = require('fs'),
  Sequelize = require('sequelize'),
          _ = require('./underscore');


var sql;

// data model
var Room, User, Update, Tag;

console.log('init');
sql = new Sequelize(config.database,
                    config.db_user,
                    config.db_pass, {
                      host: config.db_host,
                      port: config.db_port
                    });

// define the model
// really should have a unique compound key here
Room = sql.define('Room', {
  host: Sequelize.STRING,
  room: Sequelize.STRING
});

User = sql.define('User', {
  nick: Sequelize.STRING
});

Update = sql.define('Update', {
  content: Sequelize.TEXT
});

Tag = sql.define('Tag', {
  tag: Sequelize.STRING
});

// relations
Room.hasMany(User);
User.belongsTo(Room);
User.hasMany(Update);
Update.belongsTo(User);
Room.hasMany(Tag);

// many to many
Update.hasMany(Tag);
Tag.hasMany(Update);

Room.sync(); User.sync(); Update.sync(); Tag.sync();

function normalizeRoom(room) {
  while(room[0] == '#') {
    room = room.substring(1);
  }
  return room;
}

function withRoom(host, room, next) {
  Room.find({where : {host: host, room: normalizeRoom(room)}}).success(next);
}

function plainValues(list_of_objects) {
  return _.map(list_of_objects, function(obj) {return obj.values;});
}

exports.connect = function(cb) {
  cb();
};

exports.addRoom = function(host, room, cb) {
  var room = normalizeRoom(room);
  Room.find({where : {host: host, room: room}}).success(function(r) {
    if (r)
      cb();
    else
      Room.build({host: host, room: room}).save().success(function(r){cb();});
  });
};

exports.listRooms = function(cb) {
  Room.all().success(function(rooms){
    cb(null, plainValues(rooms));
  });
};

exports.logMessage = function(host, room, from, message, cb) {
  console.log("logging message " + message + " from " + from);
  var insert_message = function(user) {
    var mess = Update.build({content: message});
    mess.setUser(user).success(function(mess) {
      // parse out the tags
      var tags = message.match(/\#[^ ]+/g);
      console.log("will eventually tag with " + tags);
      cb();
    });
  };

  // get the room
  Room.find({where : {host: host, room: normalizeRoom(room)}}).success(function(room) {
    // get the user
    room.getUsers({where : {nick: from}})
      .success(function(users) {
        var user = users[0];
        if (user) {
          console.log('got user');
          insert_message(user);
        } else {
          User.build({nick: from}).setRoom(room).success(function(u) {
            insert_message(u);
          });
        }
      });
  });
};

exports.getUsers = function(host, room, cb) {
  withRoom(host, room, function(r) {
    r.getUsers().success(function(users) {
      cb(null, plainValues(users));
    });
  });
};

exports.getUpdates = function(host, room, last_n_days, cb) {
  withRoom(host, room, function(r) {
    r.getUsers().success(function(users) {
      var user_ids = _.map(users,function(u) {return u.id;});
      Update.findAll({where: {userId: user_ids}, order: "userId, createdAt desc" }).success(function(updates) {
        cb(null, plainValues(updates));
      });
    });
  });
};

exports.close = function(cb) {
/*  client.end(function(err) {
    client = undefined;
    if (cb) cb(!err ? null : err);
  });
  */
};
