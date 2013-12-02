'use strict';

/* global describe: false */
/* global it: false */

var assert = require('assert')
  , path = require('path')
  , pgPass = require( path.join('..', process.env.COV__ ? 'lib-cov' : 'lib', 'libPgPass') )
  , util = require('util')
  , Stream = require('resumer')
  , clone = require('clone')
;


describe('#getFileName()', function(){
    it('should return the default pgpass file', function(){
        var env = {
            HOME : '/tmp' ,
            APPDATA : 'C:\\tmp'
        };
        assert.equal(
            pgPass.getFileName(env) ,
            process.platform === 'win32' ? 'C:\\tmp\\postgresql\\pgpass.conf' : '/tmp/.pgpass'
        );
    });

    it('should return the the path to PGPASSFILE if set', function(){
        var env = {};
        var something = env.PGPASSFILE = 'xxx';
        assert.equal( pgPass.getFileName(env), something );
    });
});


describe('#isWin', function(){
    it('should represent the platform and can be changed', function(){
        var orgIsWin = pgPass.isWin;
        var test = 'something';
        var isWin = process.platform === 'win32';

        assert.equal(isWin, pgPass.isWin);

        pgPass.isWin = test;
        assert.equal(test, pgPass.isWin);

        pgPass.isWin = orgIsWin;
        assert.equal(isWin, pgPass.isWin);
    });
});


describe('#usePgPass()', function(){
    var testResults = {
        '660' : false ,
        '606' : false ,
        '100' : true ,
        '600' : true
    };

    Object.keys(testResults).forEach(function(octPerm){

        var decPerm = Number(parseInt(octPerm, 8));
        var res = testResults[octPerm];
        var msg = util.format(
            'should consider permission %s %s',
            octPerm, res ? 'secure' : 'not secure'
        );

        it(msg, function(){
            assert.equal( pgPass.usePgPass({ mode : decPerm }) === res , true );
        });
    });
});


describe('#parseLine()', function(){

    it('should parse a simple line', function(){
        var res = pgPass.parseLine( 'host:port:dbase:user:pass' );

        assert.deepEqual(res, {
            'host'     : 'host' ,
            'port'     : 'port' ,
            'database' : 'dbase' ,
            'user'     : 'user' ,
            'password' : 'pass'
        });
    });

    it('should handle comments', function(){
        var res = pgPass.parseLine( '  # some random comment' );
        assert.equal(res, null);
    });

    it('should handle escaped \':\' and \'\\\' right', function(){
        /* jshint -W044 */
        var res = pgPass.parseLine('some\\:host:port:some\\\\database:some\;user:somepass');
        /* jshint +W044 */
        assert.deepEqual(res, {
            'host'     : 'some:host' ,
            'port'     : 'port' ,
            'database' : 'some\\database' ,
            /* jshint -W044 */
            'user'     : 'some\;user' ,
            /* jshint +W044 */
            'password' : 'somepass'
        });
    });

    it('should ignore too short and too long lines', function(){
        var tests = [
            '::::' ,
            'host:port' ,
            'host:port:database:user:pass:some:thing:else'
        ];

        tests.forEach(function(line){
            var res = pgPass.parseLine(line);
            assert.equal(null, res);
        });
    });

});


describe('#isValidEntry()', function(){
    it('shouldn\'t report valid entries', function(){
        assert(pgPass.isValidEntry({
            'host'     : 'some:host' ,
            'port'     : 100 ,
            'database' : 'some\\database' ,
            /* jshint -W044 */
            'user'     : 'some\;user' ,
            /* jshint +W044 */
            'password' : 'somepass'
        }));
        assert(pgPass.isValidEntry({
            'host'     : '*' ,
            'port'     : '*' ,
            'database' : '*' ,
            'user'     : '*' ,
            'password' : 'somepass'
        }));
    });

    it('should find invalid entries', function(){
        assert(!pgPass.isValidEntry({
            'host'     : ''
        }));
        assert(!pgPass.isValidEntry({
            'host'     : 'host' ,
            'port'     : '100' ,
            'database' : 'database' ,
            'user'     : 'user'
        }));
        assert(!pgPass.isValidEntry({
            'host'     : 'host' ,
            'port'     : -100 ,
            'database' : 'database' ,
            'user'     : 'user' ,
            'password' : '232323'
        }));
    });
});


describe('#read()', function(){
    var fileContent = [
        'somehost:112233:somedb:someuser:somepass' ,
        'otherhost:4:otherdb:other\\:user:' ,
        'thirdhost:5:thirddb:thirduser:thirdpass'
    ].join('\n');

    it('should handle a string', function(){
        var resReturn, resCb;

        resReturn = pgPass.read(fileContent, function(err, res){
            resCb = res;
        });

        assert.notEqual( resReturn, [] );
        assert.deepEqual( resReturn, resCb );
    });

    it('should handle a buffer', function(){
        var resReturn, resCb;
        var buf = new Buffer(fileContent);

        resReturn = pgPass.read(buf, function(err, res){
            resCb = res;
        });

        assert.notEqual( resReturn, [] );
        assert.deepEqual( resReturn, resCb );
    });

    it('should handle a stream', function(done){
        var resReturn, resCb;
        var stream = new Stream().queue(fileContent).end();

        resReturn = pgPass.read(stream, function(err, res){
            assert.equal(err, null);
            assert.notEqual(res, null);
            assert.notEqual(res, []);
            done();
        });

        assert.equal( resReturn, null );
    });

});


describe('#getPassword()', function(){
    var creds = [
        {
            'host'     : 'host1' ,
            'port'     : '100' ,
            'database' : 'database1' ,
            'user'     : 'user1' ,
            'password' : 'thepassword1'
        } , {
            'host'     : '*' ,
            'port'     : '*' ,
            'database' : 'database2' ,
            'user'     : '*' ,
            'password' : 'thepassword2'
        }
    ];
    var conn1 = {
        'host'     : 'host1' ,
        'port'     : 100 ,
        'database' : 'database1' ,
        'user'     : 'user1'
    };
    var conn2 = {
        'host'     : 'host2' ,
        'database' : 'database2' ,
        'user'     : 'user2'
    };
    var conn3 = {
        'host'     : 'host3' ,
        'database' : 'database3' ,
        'user'     : 'user3'
    };

    it('should return a password', function(){
        var ret;

        ret = pgPass.getPassword(conn1, creds);
        assert.equal(ret, creds[0].password);

        ret = pgPass.getPassword(conn2, creds);
        assert.equal(ret, creds[1].password);
    });

    it('should not return and not fill in a password', function(){
        var ret;

        ret = pgPass.getPassword(conn3, undefined, true);
        assert(!ret);
        assert(!conn3.password);

        ret = pgPass.getPassword(conn1, undefined, true);
        assert(!ret);
        assert(!conn1.password);

        ret = pgPass.getPassword({}, creds, true);
        assert(!ret);
    });

    it('should return and fill in a password', function(){
        var ret;

        ret = pgPass.getPassword(conn1, creds, true);
        assert.equal(ret, creds[0].password);
        assert.equal(conn1.password, creds[0].password);

        ret = pgPass.getPassword(conn2, creds, true);
        assert.equal(ret, creds[1].password);
        assert.equal(conn2.password, creds[1].password);
    });
});