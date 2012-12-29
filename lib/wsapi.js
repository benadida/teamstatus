/**
 * ircloggr - a node.js all-in-one implementation of irc logging visible via
 *            a REST/JSON interface.
 *
 * See LICENSE file for licensing information.
 */

const     db = require('./db.js'),
         url = require('url'),
   httputils = require('./httputils.js'),
     winston = require('winston'),
      async = require('async'),
      repos = require('./repos');
      _ = require('underscore');

function repeatString(str, num) {
  return new Array(num + 1).join(str);
}

const ONE_STAR = "\u2605";
const TWO_STAR = repeatString(ONE_STAR, 2);
const THREE_STAR = repeatString(ONE_STAR, 3);
const FOUR_STAR = repeatString(ONE_STAR, 4);
const FIVE_STAR = repeatString(ONE_STAR, 5);
const NON_BLOCKER_LABELS = [ONE_STAR, TWO_STAR, THREE_STAR, FOUR_STAR];

function haveError(err, res) {
  if (!err) return false;
  winston.error("server error encountered: " + err);
  res.status(500);
  res.json({ success: false, reason: err.toString() });
  return true;
}

const USER = 'mozilla';
const REPO = 'browserid';

// a summary of all data for the new dashboard
// expected to be /summary/<host>/<room>
exports.summary = function(args, req, res) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (args.length != 3) {
    httputils.badRequest(res, "bad request url, I expect: /summary/<host>/<room>");
    return;
  }

  var host = args[1], room = args[2];
  var tag = getArgs.tag;

  var responseObj = {};

  db.getRoomAttribute(host, room, 'tags', function(err, tag_csv) {
    responseObj.tags = tag_csv? tag_csv.split(",") : null;

    // list of users
    db.getUsers(host, room, function(err, rez) {
      if (haveError(err,res)) return;
      responseObj.users = rez;

      async.map(responseObj.users, function(user, cb) {
        // get updates, maybe tagged
        if (tag)
          db.getUpdatesWithTag(host, room, user.nick, 3, 7, tag, cb);
        else
          db.getUpdates(host, room, user.nick, 3, 7, cb);
      }, function(err, results) {
        if (haveError(err, res)) return;
        responseObj.updates = {};
        results.forEach(function(items) {
          if (items && items.length > 0) {
            responseObj.updates[items[0].nick] = items;
          }
        });

        var repoData = repos.getRepoData(host, room);
        responseObj.issues = repoData.issues;

        res.json(responseObj);
      });
    });
  });
}

exports.users = function(args, req, res) {
  var urlobj = url.parse(req.url, true);
  var getArgs = urlobj.query;

  if (args.length != 3) {
    httputils.badRequest(res, "bad request url, I expect: /users/<host>/<room>");
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
  var n_days = getArgs.n_days? parseInt(getArgs.n_days) : 7;

  var host = args[1],
      room = args[2],
      nick = args[3];

  function afterQuery(err, rez)  {
    if (haveError(err, res)) return;

    // removing tag stuff from here
    res.json({items: rez});
  }

  if (nick) {
    db.getUpdates(
      host,
      room,
      nick,
      last_n,
      null,
      afterQuery);
  } else {
    db.getAllUpdates(
      host,
      room,
      n_days,
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
