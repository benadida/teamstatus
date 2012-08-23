/**
 * ircloggr - a node.js all-in-one implementation of irc logging visible via
 *            a REST/JSON interface.
 *
 * See LICENSE file for licensing information.
 */

const   db = require("./db.js"),
    config = require("./config.js"),
      asana = require("./asana.js");

const HELP_PATTERN = /^ *(i need )?help *$/i;
const ROOM_ATTRIBUTE_PATTERN = /^ *this room's (.+) is (.+) *$/i;
const TASK_PATTERN = /(.*)\#task( ?.*)/i;

// an exported array of message handlers
exports.handlers = [
  // HELP
  function(host, room, from, message, cb) {
    if (message.match(HELP_PATTERN))
      cb("instructions at " + config.deployment_url + "/help.html");
    else
      cb(null);
  },
  // SETTING A ROOM ATTRIBUTE
  function(host, room, from, message, cb) {
    var room_match = message.match(ROOM_ATTRIBUTE_PATTERN);
    if (room_match) {
      db.setRoomAttribute(host, room, room_match[1], room_match[2], function(err) {
        if (err) return cb(err);
        return cb("gotcha, set the room's " + room_match[1]);
      });
    } else {
      cb(null);
    }
  },
  // STATUS UPDATE
  function(host, room, from, message, cb) {
    db.logUpdate(host, room, from, message, function(err, update_id) {
      var success = function(update_id, extra_message) {
        var msg = from + ": status recorded at " + config.deployment_url + "/#show/" + host + "/" + db.canonicalizeRoom(room) + "/" + from + "/" + update_id;
        if (extra_message)
          msg += " " + extra_message;
        cb(msg);
      };

      if (err) {
        cb(from + ": oops, something bad happened, your status was not recorded.");
      } else {
        // is this a task?
        var task_match = message.match(TASK_PATTERN);
        if (task_match) {
          message = task_match[1] + task_match[2];
          asana.addTask(host, room, from, message, function(err, task) {
            if (err) {
              console.log(err);
              success(update_id, "but Asana task was not added");
            } else {
              success(update_id, "and added as Asana task");
            }
          });
        } else {
          return success(update_id);
        }
      }
    });
  },
  function(host, room, from, message, cb) {
    cb(from + ": I am a robot. I don't say smart things.  I just listen: " +
       config.deployment_url);
  }
];

exports.pm_handlers = [
  function(host, from, message, cb) {
    var m = message.match(/^my ([^ ]+) is (.+)$/i);

    if (m) {
      db.setUserAttribute(host, from, m[1], m[2], function(err) {
        if (err) return cb(err);

        return cb(null, "gotcha, set your " + m[1]);
      });
    } else {
      cb(null);
    }
  },
  function(host, from, message, cb) {
    var m = message.match(/^the ([^ ]+) for #([^ ]+) is (.+)$/i);

    if (m) {
      db.setRoomAttribute(host, m[2], m[1], m[3], function(err) {
        if (err) return cb(err);
        return cb(null, "gotcha, set the room's " + m[1]);
      });
    } else {
      cb(null);
    }
  },
];