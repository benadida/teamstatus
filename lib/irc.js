/**
 * ircloggr - a node.js all-in-one implementation of irc logging visible via
 *            a REST/JSON interface.
 *
 * See LICENSE file for licensing information.
 */

const irc = require('irc'),
       db = require("./db.js"),
   config = require("./config.js"),
 handlers = require("./irchandlers.js").handlers,
  winston = require('winston');

// a mapping of servernames to irc client handles
var clients = {
};

function createBot(host, room, cb) {
  console.log("creating bot in room " + room);
  var bot = new irc.Client(host, config.bot_name, {debug: config.debug_output});
  bot.addListener('error', function(message) {
    winston.debug("error connecting to " + host + " " + room);
    cb(undefined);
  });
  bot.addListener('message', function (from, to, message) {
    winston.debug('got message: ' + from + " / " + to + " / " + message + " in room " + room);

    // ignore other bots
    if (config.other_bots.indexOf(from) > -1) {
      winston.debug("ignoring other bot " + from);
      return;
    }

    // is this a public message to me?  if so, let's
    // see if there's a handler that would like to respond
    // remove the room check
    if (bot.nick.toLowerCase() == message.substr(0, bot.nick.length).toLowerCase()) {
      // chop off our name
      message = message.substr(bot.nick.length);
      // chop of typical chars that delimit our name from message
      while (message.length && (message.charAt(0) == ':' || message.charAt(0) == ',')) {
        message = message.substr(1);
      }
      message = message.trim();

      // let's try to find a handler
      function tryHandler(i) {
        if (i >= handlers.length) return;
        handlers[i](host, to, from, message, function(response) {
          if (response != undefined) {
            bot.say(to, response);
          } else {
            tryHandler(i+1);
          }
        });
      }
      tryHandler(0);
    }
  });
  bot.addListener('connect', function () {
    winston.debug("connected to " + host);
  });
  bot.addListener('registered', function () {
    winston.debug("registered on " + host + " " + room);
    cb(bot);
  });
  bot.addListener('pm', function(nick, message) {
    winston.debug('Got private message from ' + nick + ': ' + message);
  });
  bot.addListener('join', function(channel, who) {
    winston.debug(who + ' has joined ' + channel);
  });
  bot.addListener('part', function(channel, who, reason) {
    winston.debug(who + ' has left ' + channel + ': ' + reason);
  });
  bot.addListener('kick', function(channel, who, by, reason) {
    winston.debug(who + ' was kicked from ' + channel + ' by ' + by + ': ' + reason);
  });
}

/* listen to one server/room pair */
exports.listen = function(host, room, cb) {
  function join_room() {
    clients[host].bot.join(room, function(who) {
      clients[host].rooms.push(room);
      winston.debug(who + " has joined " + host + " - " + room);
      cb(null);
    });
  }
  db.addRoom(host, room, function(err) {
    if (err) return cb(err);

    if (!clients.hasOwnProperty(host)) {
      winston.debug('attempting to connect to \'' + host + "'");
      createBot(host, room, function(bot) {
        winston.debug("bot created for " + host);
        if (bot != undefined) {
          clients[host] = { bot: bot, rooms: [] };
          join_room();
        } else {
          cb("couldn't connect!");
        }
      });
    } else {
      join_room();
    }
  });
};

/* connect to all configured rooms, disconnect from rooms that aren't
 * configured */
exports.connectAllRooms = function(cb) {
  // parse config file
  try {
    config.import_config();
  } catch(e) {
    var err;
    if (e && e.code === 'EBADF') {
      err = "missing config file: " + e.path;
    } else {
      err = "problem reading config file (" + config.config_path + "): " + e;
    }
    return cb(err);
  }

  // need rooms configured, otherwise, what are we even doing?
  if (Object.keys(config.servers).length === 0) {
    return cb("No irc rooms are configured!  Go update the config file!");
  }

  // now connect to specified servers
  var toConnect = [];
  for (var host in config.servers) {
    for (var i = 0; i < config.servers[host].length; i++) {
      var room = config.servers[host][i];
      if (room.substr(0,1) != '#') room = "#" + room;
      toConnect.push([host, room]);
    }
  }

  // first, let's disconnect all rooms that are not in the array
  Object.keys(clients).forEach(function(host) {
    clients[host].rooms.forEach(function(room) {
      var found = false;
      toConnect.forEach(function(x) {
        if (x[0] === host && x[1] === room) found = true;
      });
      if (!found) {
        winston.info(host + " - " + room + " no longer configured, leaving");
        clients[host].bot.part(room);
        clients[host].rooms.splice(clients[host].rooms.indexOf(room), 1);
      }
    });
  });

  // now let's connect up to all rooms
  function connectOneRoom() {
    if (toConnect.length == 0) return cb(null);
    else {
      var cur = toConnect.shift();
      if (clients[cur[0]] && clients[cur[0]].rooms &&
          clients[cur[0]].rooms.indexOf(cur[1]) != -1)
      {
        winston.debug('already connected to: ' + cur.join(" - "));
        connectOneRoom();
      } else {
        exports.listen(cur[0], cur[1], function(err) {
          if (err) {
            winston.error("can't connect to " + cur[0] + " " + cur[1] + ": " + err);
          }
          connectOneRoom();
        });
      }
    }
  }
  connectOneRoom();
};
