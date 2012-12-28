/**
 * teamstatus - timers for fetching repos on a regular basis
 *
 * See LICENSE file for licensing information.
 */

const     db = require('./db.js'),
         url = require('url'),
   httputils = require('./httputils.js'),
     winston = require('winston'),
      async = require('async'),
     githubAPI = require('github'),
      _ = require('underscore');

// connecting to github
var github = new githubAPI({version: "3.0.0"});

// LABELS
function repeatString(str, num) {
  return new Array(num + 1).join(str);
}

const ONE_STAR = "\u2605";
const TWO_STAR = repeatString(ONE_STAR, 2);
const THREE_STAR = repeatString(ONE_STAR, 3);
const FOUR_STAR = repeatString(ONE_STAR, 4);
const FIVE_STAR = repeatString(ONE_STAR, 5);
const NON_BLOCKER_LABELS = [ONE_STAR, TWO_STAR, THREE_STAR, FOUR_STAR];

// repos to fetch
// eventually this will be configurable
const REPOS = [
  {
    host : 'irc.mozilla.org',
    room : 'identity',
    type : 'github',
    user : 'mozilla',
    repo : 'browserid',
    frequency: 60 // in seconds
  }
];

// we're going to cache this in RAM. Booya.
var REPOS_DATA = {};

// fetch repository data for one repo data structure
// as defined above in the REPOS array
//
// cb is invoked with err or nothing
function fetchRepoData(repo, cb) {
  var repoKey = repo.host + "/" + repo.room;

  // initialize
  if (!REPOS_DATA[repoKey])
    REPOS_DATA[repoKey] = {};

  // pointer to the repo data
  var repoData = REPOS_DATA[repoKey];

  // did it recently?
  if (repoData.lastFetched &&
      (Date.now() - repoData.lastFetched < (repo.frequency * 1000))) {
    return process.nextTick(cb);
  }

  // we only know github for now, but we're ready for more later
  if (repo.type != 'github')
    return process.nextTick(function() {cb('no support for ' + repo.type + ' repos');});

  console.log("fetching repo data " + repo.host + "/" + repo.room);

  // mark fetched
  repoData.lastFetched = Date.now();

  repoData.issues = {};

  github.issues.repoIssues({
    user: repo.user,
    repo: repo.repo,
    labels: FIVE_STAR,
    state: 'open'
  }, function(err, issues) {
    repoData.issues[FIVE_STAR] = issues;

    // go through each label and request
    async.forEach(NON_BLOCKER_LABELS, function(label, cb) {
      github.issues.repoIssues({
        user: repo.user,
        repo: repo.repo,
        labels: label,
        state: 'open',
        per_page: 100
      }, function(err, issues) {
        repoData.issues[label] = {
          count: issues.length,
          html_url: "https://github.com/" + repo.user + "/" + repo.repo + "/issues?labels=" + label
        };

        // done with this iteration
        cb();
      });
    }, cb); // function-level callback
  });
}

exports.getRepoData = function getRepoData(host, room) {
  var repoKey = host + "/" + room;
  return REPOS_DATA[repoKey];
};

function fetchAllRepos() {
  _.map(REPOS, function(repo) {
    fetchRepoData(repo, function(err) {
      if (err) console.log(err);
    });
  });
}

// set up the timer
require('timers').setInterval(fetchAllRepos, 1000);
