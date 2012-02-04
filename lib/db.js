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
  Sequelize = require('sequelize');


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
User.belongsTo(Room);
Update.belongsTo(User);
Tag.belongsTo(Room);

// many to many
Update.hasMany(Tag);
Tag.hasMany(Update);


exports.connect = function(cb) {
  Room.sync(); User.sync(); Update.sync(); Tag.sync();
  cb();
};

exports.addRoom = function(host, room, cb) {
  Room.build({host: host, room: room}).save().success(function(){cb();});
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
  Room.find({where : {host: host, room: room}}).success(function(room) {
    // get the user
    User.find({where : {roomId: room.id, nick: from}})
      .success(function(user) {
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

exports.close = function(cb) {
/*  client.end(function(err) {
    client = undefined;
    if (cb) cb(!err ? null : err);
  });
  */
};
