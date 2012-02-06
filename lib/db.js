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


var client;


function canonicalizeRoom(room) {
  while(room[0] == '#') {
    room = room.substring(1);
  }
  return room;
}

function canonicalizeNick(nick) {
  // remote trailing underscores
  if (nick[nick.length - 1] == '_')
    nick = nick.substring(0, nick.length - 1);

  // if |, then get the first part
  nick = nick.split('|')[0];

  return nick;
}

function withRoom(host, room, next) {
  client.query(
    'SELECT * from rooms WHERE host = ? and room = ?',
    [host, canonicalizeRoom(room)],
    function(err, rooms) {
      next(rooms[0]);
    });
}

// mostly works for inserts
function chainQueries(queries_and_vars, cb) {
  function oneQuery(i) {
    if (i >= queries_and_vars.length)
      return cb();

    var one_query = queries_and_vars[i];
    
    client.query(one_query[0], one_query[1], function(err) {
      if (err) cb(err);
      else oneQuery(i+1);
    });
  }
  
  oneQuery(0);
}

const schemas = [
  "CREATE TABLE IF NOT EXISTS rooms (" +
    "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
    "host VARCHAR(256)," +
    "room VARCHAR(64)," +
    "unique host_and_room (host, room)" +
    ") ENGINE=InnoDB;",

  "CREATE TABLE IF NOT EXISTS users (" +
    "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
    "room_id BIGINT NOT NULL," +
    "nick VARCHAR(250) NOT NULL," +
    "FOREIGN KEY room_fkey (room_id) REFERENCES rooms(id), " +
    "UNIQUE room_and_nick (room_id, nick)" +
    ") ENGINE=InnoDB;",

  "CREATE TABLE IF NOT EXISTS updates (" +
    "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
    "user_id BIGINT NOT NULL," +
    "at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL," +
    "content TEXT," +
    "FOREIGN KEY user_fkey (user_id) REFERENCES users(id)" +
    ") ENGINE=InnoDB;",

  "CREATE TABLE IF NOT EXISTS tags (" +
    "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
    "room_id BIGINT NOT NULL," +
    "tag VARCHAR(200) NOT NULL UNIQUE," +
    "FOREIGN KEY room_fkey (room_id) REFERENCES rooms(id)" +
    ") ENGINE=InnoDB;",

  "CREATE TABLE IF NOT EXISTS update_tags (" +
    "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
    "update_id BIGINT NOT NULL," +
    "tag_id BIGINT NOT NULL," +
    "FOREIGN KEY update_fkey (update_id) REFERENCES updates(id)," +
    "FOREIGN KEY tag_fkey (tag_id) REFERENCES tags(id)" +
    ") ENGINE=InnoDB;",
];

const TABLES_TO_DROP = ['update_tags', 'tags', 'updates', 'users', 'rooms'];

// use with caution!
exports.createSchema = function(cb) {
  function createNextTable(i) {
    if (i < schemas.length) {
      console.log(schemas[i]);
      client.query(schemas[i], function(err) {
        if (err) {
          cb(err);
        } else {
          createNextTable(i+1);
        }
      });
    } else {
      cb();
    }
  }
  createNextTable(0);
};

exports.dropSchema = function(cb) {
  TABLES_TO_DROP.forEach(function(table) {
    // error callback so we don't care if the table is not there
    client.query("DROP TABLE " + table, function(err) {});
  });
  cb();
};

exports.numTables = function(cb) {
  client.query("SHOW TABLES", function(err, r) {
    if (err) return cb(err);
    cb(null, r.length);
  });  
};

exports.connect = function(cb) {
  var options = {
    host: config.db_host,
    port: config.db_port,
    user: config.db_user,
    password: config.db_pass,
    database: config.database
  };

  client = mysql.createClient(options);

  client.ping(cb);
};

exports.addRoom = function(host, room, cb) {
  var room = canonicalizeRoom(room);
  client.query('INSERT IGNORE INTO rooms (host, room) VALUES(?,?)',
               [host, room],
               cb);
};

exports.listRooms = function(cb) {
  client.query(
    "SELECT *, " +
      "(select count(*) from users where room_id=rooms.id) as num_users " +
      " FROM rooms order by room", [],
    function(err, rows) {
      if (err) cb(err);
      else cb(null, rows);
    });  
};

exports.logUpdate = function(host, room, from, message, cb) {
  withRoom(host, room, function(r) {
    if (!r) {
      return cb('no such room');
    }

    from = canonicalizeNick(from);
    
    // insert the user if need be
    client.query(
      'INSERT IGNORE INTO users (room_id, nick) VALUES (?,?)',
      [r.id, from],
      function(err, res) {
        if (err) return cb(err);
        
        // insert the status update
        client.query(
          'INSERT INTO updates (user_id, content) ' +
            'SELECT id, ? from users ' +
            'WHERE room_id = ? and nick = ?',
          [message, r.id, from],
          function(err, res) {
            if (err) return cb(err);

            var tags = message.match(/\#[^ ]+/g);

            // eventually add the tags
            cb();
          });
      });
  });
};

exports.getUsers = function(host, room, cb) {
  withRoom(host, room, function(r) {
    client.query(
      "SELECT * FROM users " +
        "WHERE room_id = ?",
      [r.id],
      function(err, rows) {
        if (err) cb(err);
        else cb(null, rows);
      });  
  });
};

exports.getUpdates = function(host, room, nick, last_n_days, cb) {
  withRoom(host, room, function(r) {
    client.query(
      'SELECT * from updates,users ' +
        'WHERE updates.user_id = users.id ' +
        'AND users.room_id = ? AND users.nick = ? ' +
        'AND date_add(at, interval ? day) > current_timestamp() ' +
        'ORDER BY at desc',
      [r.id, nick, last_n_days],
      cb
    );
  });
};

exports.close = function(cb) {
  client.end(function(err) {
    client = undefined;
    if (cb) cb(!err ? null : err);
  });
};
