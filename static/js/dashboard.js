
// figure out the host and room
var hash = document.location.hash;
var m = hash.match(/^#([^/]+)\/([^/]+)/);
var HOST = m[1];
var ROOM = m[2];

// TEMPLATES

var updateTemplateFirst = '<div class="row"><div class="two columns"><span class="label right">{{nick}}:</span></div><div class="ten columns">{{{content}}} <span style="font-size:0.7em;">[{{nice_at}}]</span></div></div>';

var updateTemplateNext = '{{#items}}<div class="row"><div class="ten columns offset-by-two">{{{content}}} <span style="font-size:0.7em;">[{{nice_at}}]</span></div></div>{{/items}}<div class="row">&nbsp;</div>';

var fiveStarDetailTemplate = '{{#issues}}<p>[<a target="_new" href="{{html_url}}">{{number}}</a>] {{title}}</p>{{/issues}}';

var issueCountTemplate = '{{#issueCounts}}<h6><a target="_new" href="{{html_url}}">{{count}}</a> {{#numStars}}<i class="foundicon-star"></i>{{/numStars}}</h6>{{/issueCounts}}';

var tagsTemplate = '<dd class="active"><a class="tag" id="tag_all">all</a></dd>{{#tags}}<dd><a class="tag" id="tag_{{tag}}">#{{tag}}</a></dd>{{/tags}}';

// STARS
function repeatString(str, num) {
  return new Array(num + 1).join(str);
}

var ONE_STAR = "\u2605";
var TWO_STAR = repeatString(ONE_STAR, 2);
var THREE_STAR = repeatString(ONE_STAR, 3);
var FOUR_STAR = repeatString(ONE_STAR, 4);
var FIVE_STAR = repeatString(ONE_STAR, 5);

// update formatting
var linkRegex = /(https?:\/\/[^ ]+)/g;

var markupTable = {
  0x02: "b",
  0x11: "tt",
  0x1d: "i",
  0x1f: "ul"
};

function formatMessage(msg) {
  // entity encode
  msg = $("<div/>").text(msg).html();

  // make links clickable
  msg = msg.replace(linkRegex, function (match) {
    return '<a href="' + match + '">' + match + "</a>";
  });

  // color highlight messages
  var openTags = [ ];
  var msgbuf = "";
  function closeTags(until) {
    while (openTags.length) {
      var t = openTags.pop();
      msgbuf += "</" + t + ">";
      if (until && until == t) break;
    }
  }
  function isOpen(t) {
    for (var i=0; i < openTags.length; i++) if (openTags[i] == t) return true;
    return false;
  }
  function openTag(t) {
    msgbuf += "<" + t + ">";
    openTags.push(t);
  }
  for (var i =0; i < msg.length; i++) {
    if (markupTable.hasOwnProperty(msg.charCodeAt(i))) {
      var t = markupTable[msg.charCodeAt(i)];
      if (isOpen(t)) closeTags(t);
      else openTag(t);
    } else if (msg.charCodeAt(i) == 0x0f) {
      closeTags();
    } else if (msg.charCodeAt(i) == 0x03) {
      if (isOpen('span')) closeTags('irc');

      // span coloring!
      var color = undefined;
      if (msg.charCodeAt(i+1) >= 0x30 &&  msg.charCodeAt(i+1) <= 0x39) {
        if (msg.charCodeAt(i+2) >= 0x30 &&  msg.charCodeAt(i+2) <= 0x39) {
          color = parseInt(msg.substr(i+1,2), 10);
          i += 2;
        } else {
          color = parseInt(msg.substr(i+1,1), 10);
          i += 1;
        }
      }
      if (color != undefined && color >= 0 && color <= 15) {
        msgbuf += "<span class=\"clr_" + color.toString() + "\">";
        openTags.push("span");
      }
    } else if (msg.charCodeAt(i) < 32 && msg.charCodeAt(i) != 1) {
      // uh oh, unknown control code!  add a question mark to output
      msgbuf += "?(" + msg.charCodeAt(i) + ")";
    } else {
      msgbuf += msg.charAt(i);
    }
  }
  closeTags();
  msg = msgbuf;

  return msg;
}

function addUpdatesFromUser(nick, updates) {
  // make dates nice
  updates.forEach(function(update) {
    update.nice_at = moment(update.at).fromNow();
    update.content = formatMessage(update.content);
  });

  var renderedFirst = Mustache.render(updateTemplateFirst, updates[0]);
  var renderedNext = Mustache.render(updateTemplateNext, {items: updates.slice(1)});
  $(renderedFirst).appendTo('#updates');
  $(renderedNext).appendTo('#updates');
}

function addUpdatesFromAllUsers(updates) {
  $('#updates').html('');
  _.pairs(updates).forEach(function(userAndUpdates) {
    addUpdatesFromUser(userAndUpdates[0], userAndUpdates[1]);
  });
}

function addBlockers(issues) {
  $('#fiveStarModalContent').html('');
  $('#blockers').hide();

  if (issues && (issues.length > 0)) {
    // add the count
    $('#fiveStarCount').html(issues.length.toString());

    // add the content
    var rendered = Mustache.render(fiveStarDetailTemplate, {issues: issues});
    $(rendered).appendTo('#fiveStarModalContent');

    // show it
    $('#blockers').show();
  }
}

function addIssueCounts(issues) {
  $('#issueCounts').html('');

  if (!issues[FOUR_STAR]) {
    processedIssues = [];
  } else {
    var processedIssues = [
      {numStars: new Array(4), count: issues[FOUR_STAR].count, html_url: issues[FOUR_STAR].html_url},
      {numStars: new Array(3), count: issues[THREE_STAR].count, html_url: issues[THREE_STAR].html_url},
      {numStars: new Array(2), count: issues[TWO_STAR].count, html_url: issues[TWO_STAR].html_url},
      {numStars: new Array(1), count: issues[ONE_STAR].count, html_url: issues[ONE_STAR].html_url}
    ];
  }

  var rendered = Mustache.render(issueCountTemplate, {issueCounts: processedIssues});
  $(rendered).appendTo('#issueCounts');
}

var tagsAdded=false;
function addTags(tags) {
  // let's do this one only if we haven't done it before
  if (tagsAdded)
    return;
  tagsAdded = true;

  if (!tags || !tags.length)
    return;

  var rendered = Mustache.render(tagsTemplate, {
    tags: _.map(tags, function(t) {
      return {
        tag:t,
        host: HOST,
        room: ROOM
      };
    })});
  $(rendered).appendTo('#tags');
}

function updateAll(host, room, tag, cb) {
  var url = '/api/summary/' + host + '/' + room;
  if (tag)
    url += '?tag=' + encodeURIComponent(tag);

  $.get(url, function(result) {
    // tags
    addTags(result.tags);

    // blockers
    addBlockers(result.issues[FIVE_STAR]);

    // bug counts
    addIssueCounts(result.issues);

    // status updates
    addUpdatesFromAllUsers(result.updates);

    if (cb)
      cb();
  });
}

$(document).ready(function() {
  updateAll(HOST, ROOM, null, function() {
    $('.tag').click(function(evt) {
      var tag = evt.target.id.match('tag_(.+)')[1];

      if (tag == 'all')
        updateAll(HOST, ROOM, null);
      else
        updateAll(HOST, ROOM, tag);
    });
  });
});


