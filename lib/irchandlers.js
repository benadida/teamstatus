/**
 * ircloggr - a node.js all-in-one implementation of irc logging visible via
 *            a REST/JSON interface.
 *
 * See LICENSE file for licensing information.
 */

const   db = require("./db.js"),
    config = require("./config.js");

// an exported array of message handlers
exports.handlers = [
    function(host, room, from, message, cb) {
      db.logUpdate(host, room, from, message, function(err, update_id) {
        if (err) {
          cb(from + ": oops, something bad happened, your status was not recorded.");
        } else {
          cb(from + ": status recorded at " + config.deployment_url + "/#show/" + host + "/" + db.canonicalizeRoom(room) + "/" + from + "/" + update_id);
        }
      });
    },
    function(host, room, from, message, cb) {
        cb(from + ": I am a robot. I don't say smart things.  I just listen: " +
           config.deployment_url);
    }
];
