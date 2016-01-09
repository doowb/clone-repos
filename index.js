/*!
 * clone-repos <https://github.com/doowb/clone-repos>
 *
 * Copyright (c) 2015, Brian Woodward.
 * Licensed under the MIT License.
 */

'use strict';

var utils = require('./utils');
var path = require('path');
var assert = require('assert');
var exec = require('child_process').exec;

module.exports = function (config) {
  var options = {};
  config = config || {};
  assert(config.owner, 'Expected `owner` to be set.');
  config.dest = config.dest || process.cwd();

  if (config.auth) {
    if (config.auth.type === 'basic') {
      assert(config.auth.username, 'Expected a `username` for basic authentication');
      assert(config.auth.password, 'Expected a `password` for basic authentication');
      options.username = config.auth.username;
      options.password = config.auth.password;
    } else if (config.auth.type === 'oauth') {
      assert(config.auth.token, 'Expected a `token` for oauth authentication');
      options.token = config.token;
    }
  }

  config.owner = utils.arrayify(config.owner);
  var github = utils.githubBase(options);

  utils.async.eachSeries(config.owner, function (owner, next) {
    var params = {
      user: owner
    };

    github.getAll('/users/:user/repos', params, function(err, repos) {
      if (err) return next(err);
      console.log(repos);
      var sources = repos.filter(function (repo) {
        return !repo.fork;
      });
      var q = utils.async.queue(clone.bind(clone, config.dest), 8);
      q.drain = next;

      var retries = {};
      utils.async.each(sources, function (repo) {
        retries[repo.full_name] = 0;
        q.push(repo, function done (err) {
          if (err) {
            console.error(err);
            if (retries[repo.full_name] < 3) {
              retries[repo.full_name]++;
              console.log('Retry attempt (' + retries[repo.full_name] + ') for', repo.full_name);
              return q.push(repo, done);
            }
          }
        });
      });
    });
  }, function (err) {
    if (err) return console.error(err);
  });
};

function clone (cwd, repo, next) {
  if (typeof repo === 'function') {
    next = repo;
    repo = cwd;
    cwd = process.cwd();
  }
  cwd = path.resolve(path.join(cwd || process.cwd(), repo.owner.login));
  utils.mkdirp.sync(cwd);

  var cmd = 'git clone ' + repo.clone_url;
  exec(cmd, {cwd: cwd}, function (err, stdout, stderr) {
    if (err) return next(err);
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    next();
  });
}
