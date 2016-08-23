'use strict';

var clone = require('./');
var options = {
  owner: 'doowb',
  filter: function(repo) {
    return repo.name.indexOf('npm-api') !== -1;
  }
};

clone(options, function(err, repos) {
  if (err) return console.error(err);
  console.log('cloned', repos);
});
