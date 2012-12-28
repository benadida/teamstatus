
var updateTemplateFirst = '<div class="row"><div class="two columns"><tt class="label right">{{nick}}:</tt></div><div class="ten columns">{{content}}</div></div>';
var updateTemplateNext = '{{#items}}<div class="row"><div class="ten columns offset-by-two">{{content}}</div></div>{{/items}}<div class="row">&nbsp;</div>';

function addUpdatesFromUser(nick, updates) {
  var renderedFirst = Mustache.render(updateTemplateFirst, updates[0]);
  var renderedNext = Mustache.render(updateTemplateNext, updates.slice(1));
  $(renderedFirst).appendTo('#updates');
  $(renderedNext).appendTo('#updates');
}

$(document).ready(function() {
  $.get('/api/summary/' + HOST + '/' + ROOM, function(result) {
    _.pairs(result.updates).forEach(function(userAndUpdates) {
      addUpdatesFromUser(userAndUpdates[0], userAndUpdates[1]);
    });
  });
});