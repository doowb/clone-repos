'use strict';

require('mocha');
var fs = require('fs');
var del = require('delete');
var assert = require('assert');
var cloneRepos = require('./');

describe('clone-repos', function() {
  afterEach(del.bind(del, 'actual'));

  it('should export a function', function() {
    assert.equal(typeof cloneRepos, 'function');
  });

  it('should throw an error when invalid args are passed', function(cb) {
    try {
      cloneRepos();
      cb(new Error('expected an error'));
    } catch (err) {
      assert(err);
      assert.equal(err.message, 'Expected `owner` to be set.');
      cb();
    }
  });

  it('should clone repos', function(cb) {
    this.timeout(60000);
    var options = {
      owner: 'doowb',
      dest: 'actual',
      filter: function(repo) {
        return repo.name === 'npm-api';
      }
    };

    cloneRepos(options, function(err, repos) {
      if (err) {
        if (/rate limit exceeded/.test(err.message)) {
          console.log('[WARNING]:', err.message);
          return cb();
        }
        return cb(err);
      }
      try {
        assert.deepEqual(repos, ['doowb/npm-api']);
      } catch (err) {
        return cb(err);
      }
      fs.stat('actual/doowb/npm-api', function(err, stat) {
        if (err) return cb(err);
        try {
          assert.equal(stat.isDirectory(), true);
          cb();
        } catch (err) {
          cb(err);
        }
      });
    });
  });
});
