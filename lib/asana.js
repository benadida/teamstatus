/**
 * See LICENSE file for licensing information.
 */

const   db = require("./db.js"),
      asana= require("asana-api");

function getClient(host, nick, cb) {
  db.getUserAttribute(host, nick, 'asana-api-key', function(err, apiKey) {
    if (err)
      return cb(err);

    return cb(null, asana.createClient({apiKey: apiKey}));
  });
}

function getProjectId(host, room, cb) {
  db.getRoomAttribute(host, room, 'asana-project-id', function(err, projectId) {
    if (err) return cb(err);

    return cb(null, projectId);
  });
}

function getWorkspaceId(host, room, cb) {
  db.getRoomAttribute(host, room, 'asana-workspace-id', function(err, workspaceId) {
    if (err) return cb(err);

    return cb(null, workspaceId);
  });
}

exports.addTask = function(host, room, from, message, cb) {
  getClient(host, from, function(err, client) {
    if (err) return cb(err);

    getWorkspaceId(host, room, function(err, workspaceId) {
      if (err) return cb(err);

      getProjectId(host, room, function(err, projectId) {
        if (err) return cb(err);

        client.tasks.create(workspaceId, projectId, {
          name: message
        }, function(err, task) {
          if (err) return cb(err);

          return cb(null, task);
        });
      });
    });
  });
};