/**
 * ircloggr - a node.js all-in-one implementation of irc logging visible via
 *            a REST/JSON interface.
 *
 * See LICENSE file for licensing information.
 */

const     db = require('./db.js'),
         url = require('url'),
   httputils = require('./httputils.js'),
     winston = require('winston');

function haveError(err, res) {
  if (!err) return false;
  winston.error("server error encountered: " + err);
  res.status(500);
  res.json({ success: false, reason: err.toString() });
  return true;
}

exports.users = function(args, req, res) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (args.length != 3) {
    httputils.badRequest(resp, "bad request url, I expect: /users/<host>/<room>");
    return;
  }

  db.getUsers(
    args[1],
    args[2],
    function(err, rez)  {
      if (haveError(err, res)) return;
      res.json(rez);
    });
};

// these will be sorted by user then reverse update time by default
exports.updates = function(args, req, res) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (args.length < 3) {
    httputils.badRequest(res, "bad request url, I expect: /updates/<host>/<room> or /updates/<host>/<room>/<nick>");
    return;
  }

  // how many days back of updates?
  var last_n = getArgs.last_n? parseInt(getArgs.last_n) : 4;

  var host = args[1],
      room = args[2],
      nick = args[3];

  function afterQuery(err, rez)  {
    if (haveError(err, res)) return;
    rez.forEach(function(item) {
      item.label = item.content;
    });
    res.json({items: rez});
  }

  if (nick) {
    db.getUpdates(
      host,
      room,
      nick,
      last_n,
      afterQuery);
  } else {
    db.getAllUpdates(
      host,
      room,
      last_n,
      afterQuery);
  }
};

exports.rooms = function(args, req, res) {
  db.listRooms(function(err, r) {
    if (!haveError(err, res)) res.json(r);
  });
};

exports.code_update = function(args, req, resp) {
  winston.warn("going down for code update!");
  process.exit(0);
}

exports.ping = function(args, req, res) {
  res.json(true);
};
