'use strict';

/* global describe: false */
/* global it: false */

var assert = require('assert')
  , path = require('path')
  , pgPass = require( path.join('..', process.env.COV__ ? 'lib-cov' : 'lib') )
  , clone = require('clone')
;


var conn = {
    'host'     : 'host1' ,
    'port'     : 100 ,
    'database' : 'somedb' ,
    'user'     : 'user2'
};

describe('MAIN', function(){
    describe('#(conn, cb)', function(){
        it('should ignore non existant file', function(done){
            process.env.PGPASSFILE = path.join(__dirname, '_no_such_file_');
            pgPass(conn, function(res){
                assert('undefined' === typeof res);
                done();
            });
        });

        it('should read .pgpass', function(done){
            process.env.PGPASSFILE = path.join(__dirname, '_pgpass');
            pgPass(conn, function(res){
                assert('pass2' === res);
                done();
            });
        });
    });

    describe('#(conn)', function(){
        it('should ignore non existant file', function(){
            process.env.PGPASSFILE = path.join(__dirname, '_no_such_file_');
            assert(!pgPass(conn));
        });

        it('should read .pgpass', function(){
            process.env.PGPASSFILE = path.join(__dirname, '_pgpass');
            assert(pgPass(conn) === 'pass2');
        });
    });
});
