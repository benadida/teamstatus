#!/usr/bin/env node

const
assert = require('assert'),
vows = require('vows'),
db = require('../lib/db.js'),
config = require('../lib/config.js');

var suite = vows.describe('db');
suite.options.error = false;

suite.addBatch({
  "connect to database": {
    topic: function() {
      db.connect(this.callback);
    },
    "works": function(err) {
      assert.isNull(err);
    }
  }
});

suite.addBatch({
  "drop schema": {
    topic: function() {
      db.dropSchema(this.callback);
    },
    "works": function(err) {
      assert.isUndefined(err);
    }
  }
});

suite.addBatch({
  "create schema": {
    topic: function() {
      db.createSchema(this.callback);
    },
    "works": function(err) {
      assert.isUndefined(err);
    },
    "results in": {
      topic: function() {
        db.numTables(this.callback);
      },
      "more than 0 tables": function(err, num) {
        assert.isNull(err);
        assert.notEqual(num, 0);
      }
    }
  }
});

suite.addBatch({
  "adding one new room": {
    topic: function() {
      db.addRoom("irc.freenode.net", "yajl", this.callback);
    },
    "works": function(err) {
      assert.isNull(err);
    }
  },
  "adding a second new room simultaneously": {
    topic: function() {
      db.addRoom("irc.mozilla.org", "identity", this.callback);
    },
    "works": function(err) {
      assert.isNull(err);
    }
  }
});

suite.addBatch({
  "listing rooms": {
    topic: function() {
      db.listRooms(this.callback);
    },
    "shows the two we expect": function(err, r) {
      r.forEach(function(logged) {
        assert.ok([ 'irc.mozilla.org', 'irc.freenode.net' ].indexOf(logged.host) !== -1);
        assert.ok([ 'yajl', 'identity' ].indexOf(logged.room) !== -1);
      });
    }
  }
});

suite.addBatch({
  "log message": {
    topic: function() {
      db.logUpdate('irc.mozilla.org', 'identity', 'benadida', 'in meetings again', this.callback);
    },
    "works": function(err) {
      assert.isNull(err);
    },
    "and when queried": {
      topic: function() {
        db.getUpdates('irc.mozilla.org', 'identity', 'benadida', 3, this.callback);
      },
      "works": function(err) {
        assert.isNull(err);        
      },
      "returns at least one row": function(err, updates) {
        assert.notEqual(updates.length, 0);
      },
      "contains the right thing": function(err, updates) {
        assert.isTrue(updates[0].content.indexOf("meetings") > -1);
      }
    }
  }
});

suite.addBatch({
  "get users": {
    topic: function() {
      db.getUsers('irc.mozilla.org', 'identity', this.callback);
    },
    "works": function(err) {
      assert.isNull(err);
    },
    "has more than one row": function(err, users) {
      assert.notEqual(users.length, 0);
    },
    "contains the right thing": function(err, users) {
      assert.equal(users[0].nick,'benadida');
    }
  }
});


suite.addBatch({
  "log message with away nick": {
    topic: function() {
      db.logUpdate('irc.mozilla.org', 'identity', 'benshmadida|away', 'hacking on code', this.callback);
    },
    "works": function(err) {
      assert.isNull(err);
    },
    "and when queried": {
      topic: function() {
        db.getUpdates('irc.mozilla.org', 'identity', 'benshmadida', 3, this.callback);
      },
      "works": function(err) {
        assert.isNull(err);        
      },
      "returns at least one row": function(err, updates) {
        assert.notEqual(updates.length, 0);
      },
      "contains the right thing": function(err, updates) {
        assert.isTrue(updates[0].content.indexOf("hacking") > -1);
      }
    }
  }
});

suite.addBatch({
  "log message with double login": {
    topic: function() {
      db.logUpdate('irc.mozilla.org', 'identity', 'badida_', 'architecture thinking', this.callback);
    },
    "works": function(err) {
      assert.isNull(err);
    },
    "and when queried": {
      topic: function() {
        db.getUpdates('irc.mozilla.org', 'identity', 'badida', 3, this.callback);
      },
      "works": function(err) {
        assert.isNull(err);        
      },
      "returns at least one row": function(err, updates) {
        assert.notEqual(updates.length, 0);
      },
      "contains the right thing": function(err, updates) {
        assert.isTrue(updates[0].content.indexOf("architecture") > -1);
      }
    }
  }
});

suite.addBatch({
  "closing the database": {
    topic: function() { db.close(this.callback); },
    works: function(err) { assert.isNull(err); }
  }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
