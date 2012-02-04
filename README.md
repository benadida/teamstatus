
statuslogr is a status dashboard builder based on irc. This code heavily borrows from ircloggr.

## Software Prerequisites

  * node.js (0.6.x)
  * deps listed in `package.json`
  * a mysql/postgres database to connect to

## Testing & Development

### The web server

  1. Install node.js
  2. git clone this repository
  3. npm install
  4. install mysql, create a `statuslogr` database, grant all privs to `statuslogr` user
  5. PORT=8080 npm start

Visit `http://127.0.0.1:8080/` in your browser

### The logger daemon

  1. SERVERS=irc.freenode.net=statuslogr_test bin/statuslogr_log

Now log into `irc.freenode.net` #statuslogr_test and notice that your utterances are
visible through the web view.

## Deployment

Now that you've got it running, deployment on any provider should be pretty
straightforward.  Here are steps to get up and running on heroku:

  * heroku create --stack cedar --buildpack http://github.com/hakobera/heroku-buildpack-nodejs.git // create a new app on heroku using node 0.6+
  * heroku addons:add cleardb:ignite // add a mysql database
  * heroku config:add IP_ADDRESS=0.0.0.0
  * heroku config:add BOT_NAME=my_statuslogr_bot
  * git push heroku master

you should be running!  now let's configure a room and the daemon

  * heroku config:add SERVERS=irc.freenode.net=statuslogr_testroom
  $ heroku scale web=1 worker=1