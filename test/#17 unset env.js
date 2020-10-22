'use strict';

/* global describe: false */
/* global it: false */
/* global after: false */
/* global before: false */

var assert = require('assert')
  , path = require('path')
  , helper = require( path.join('..', 'lib' , 'helper') )
;

describe('#17 when env is empty', function(){
    var fakeEnv = {};

    describe('getting the pgpass filename', function(){
	var checkFileName = function(expected) {
	    assert.doesNotThrow(function(){
		var actual = helper.getFileName(fakeEnv);
		assert.equal(actual, expected);
	    });
	};

	describe('on unix-ish envs', function(){
	    it('should not fail', function() {
		checkFileName('.pgpass');
	    });
	});

	describe('on windows', function(){
	    before(function(){
		helper.isWin = true;
	    });
	    after(function(){
		helper.isWin = (process.platform === 'win32');
	    });

	    it('should not fail', function() {
		checkFileName(path.join('postgresql', 'pgpass.conf'));
	    });
	});
    });
});

