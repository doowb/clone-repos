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

var github = new utils.github({
  version: '3.0.0',
  debug: false,
  protocol: 'https',
  timeout: 5000
});

var getRepos = getListFromGithub('repos', 'getFromUser');

module.exports = function (config) {
  config = config || {};
  assert(config.owner, 'Expected `owner` to be set.');
  config.dest = config.dest || process.cwd();

  if (config.auth) {
    if (config.auth.type === 'basic') {
      assert(config.auth.username, 'Expected a `username` for basic authentication');
      assert(config.auth.password, 'Expected a `password` for basic authentication');
    } else if (config.auth.type === 'oauth') {
      assert(config.auth.token, 'Expected a `token` for oauth authentication');
    }
    github.authenticate(config.auth);
  }

  config.owner = Array.isArray(config.owner) ? config.owner : [config.owner];

  utils.async.eachSeries(config.owner, function (owner, next) {
    var params = {
      user: owner
    };

    getRepos(params, function (repo) {
      return repo;
    }, function (err, repos) {
      if (err) return next(err);
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

function getListFromGithub (list, method) {
  var arr = [];
  return function getNext (opts, map, done) {
    opts.page = opts.page || 1;
    github[list][method](opts, function (err, data) {
      if (err) return done(err);
      if (data.length === 0) {
        var res = arr;
        arr = [];
        return done(null, res);
      }
      arr = arr.concat.apply(arr, data.map(map));
      opts.page++;
      getNext(opts, map, done);
    });
  };
}
