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

/**
 * Clone all repositories for the specified `owner`.
 * All repositories will be cloned into a folder with the owner's name.
 * The `options.dest` property may be set to specify where the repositories are cloned.
 *
 * ```js
 * clone({owner: 'doowb'}, function(err, repos) {
 *   if (err) return console.error(err);
 *   console.log('cloned', repos);
 * });
 * ```
 * @param {Object} `options`
 * @param {String|Array} `options.owner` Github `user` or `org` name to clone.
 * @param {String} `options.dest` Destination folder for cloned repositories (defaults to `owner`).
 * @param {Object} `options.auth` Authentication object to use to authenticate to github to extend github api limits.
 * @param {String} `options.auth.type` Authentication type to use. May be `basic` or `oauth`.
 * @param {String} `options.auth.username` Github `username` to use when using `basic` authentication.
 * @param {String} `options.auth.password` Github `password` to use when using `basic` authentication.
 * @param {String} `options.auth.token` Github personal access token to use when using `oauth` authentication.
 * @param {Function} `options.filter` Optional filter function to filter out repositories that should not be cloned.
 * @param {Function} `cb` Callback function called with `err` and `repos` object containing list of cloned repositories.
 * @api public
 * @name clone
 */

module.exports = function(options, cb) {
  var opts = {};
  options = options || {};
  assert(options.owner, 'Expected `owner` to be set.');
  options.dest = options.dest || process.cwd();

  if (options.auth) {
    if (options.auth.type === 'basic') {
      assert(options.auth.username, 'Expected a `username` for basic authentication');
      assert(options.auth.password, 'Expected a `password` for basic authentication');
      opts.username = options.auth.username;
      opts.password = options.auth.password;
    } else if (options.auth.type === 'oauth') {
      assert(options.auth.token, 'Expected a `token` for oauth authentication');
      opts.token = options.token;
    }
  }

  options.owner = utils.arrayify(options.owner);
  var github = utils.githubBase(opts);
  var cloned = [];
  var filter = typeof options.filter === 'function'
    ? options.filter
    : function() { return true; };

  utils.async.eachSeries(options.owner, function (owner, next) {
    var params = {
      user: owner
    };

    github.getAll('/users/:user/repos', params, function(err, repos) {
      if (err) return next(err);
      if (repos && repos.message && /rate limit exceeded/.test(repos.message)) {
        return next(new Error(repos.message));
      }

      var sources = repos.filter(function (repo) {
        return filter(repo) && !repo.fork;
      });
      var q = utils.async.queue(clone.bind(clone, options.dest), 8);
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
          cloned.push(repo.full_name);
        });
      });
    });
  }, function(err) {
    if (err) return cb(err);
    cb(null, cloned);
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
