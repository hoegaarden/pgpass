'use strict';

/* global describe: false */
/* global it: false */

/* jshint -W106 */
var COV = process.env.npm_lifecycle_event === 'coverage';
/* jshint +W106 */

var assert = require('assert')
  , path = require('path')
  , pgPass = require( path.join('..', COV ? 'lib-cov' : 'lib' , 'index') )
;


var conn = {
    'host'     : 'host1' ,
    'port'     : 100 ,
    'database' : 'somedb' ,
    'user'     : 'user2'
};

describe('MAIN', function(){
    describe('#(conn, cb)', function(){
        it('should ignore non existent file', function(done){
            process.env.PGPASSFILE = path.join(__dirname, '_no_such_file_');
            pgPass(conn, function(res){
                assert(undefined === res);
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

        it('should not read .pgpass because of PGPASSWORD', function(done){
            process.env.PGPASSFILE = path.join(__dirname, '_pgpass');
            process.env.PGPASSWORD = 'something';
            pgPass(conn, function(res){
                assert(undefined === res);
                delete process.env.PGPASSWORD;
                done();
            });
        });
    });

    describe('#(conn)', function(){
        it('should ignore non existent file', function(){
            process.env.PGPASSFILE = path.join(__dirname, '_no_such_file_');
            assert(!pgPass(conn));
        });

        it('should read .pgpass', function(){
            process.env.PGPASSFILE = path.join(__dirname, '_pgpass');
            assert(pgPass(conn) === 'pass2');
        });

        it('should not read .pgpass because of PGPASSWORD', function(){
            process.env.PGPASSFILE = path.join(__dirname, '_pgpass');
            process.env.PGPASSWORD = 'something';
            assert(undefined === pgPass(conn));
            delete process.env.PGPASSWORD;
        });
    });
});
