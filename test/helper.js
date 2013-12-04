'use strict';

/* global describe: false */
/* global it: false */
/* global after: false */
/* global before: false */

/* jshint -W106 */
var COV = process.env.npm_lifecycle_event === 'coverage';
/* jshint +W106 */

var assert = require('assert')
  , path = require('path')
  , helper = require( path.join('..', COV ? 'lib-cov' : 'lib', 'helper') )
  , util = require('util')
  , Stream = require('resumer')
;


describe('#warnTo()', function(){
    it('should be process.stderr by default', function(){
        var stdErr = process.stderr;
        var org = helper.warnTo( stdErr );
        assert(org === stdErr);
    });

    it('should not caus problems to give a non-stream', function(){
        var orgStream = helper.warnTo(null);
        assert( false === helper.usePgPass({mode:6}) );
        helper.warnTo(orgStream);
    });

    it('should write warnings to our writable stream', function(done){
        var stream = new Stream();

        var orgStream = helper.warnTo(stream);
        var orgIsWin = helper.isWin;
        helper.isWin = false;

        assert( process.stderr === orgStream );
        assert( false === helper.usePgPass({mode:6}) );

        stream.on('data', function(d){
            assert(
                0 === d.indexOf('WARNING: password file "<unkn>" is not a plain file')
            );

            helper.orgisWin = orgIsWin;
            helper.warnTo(orgStream);
            stream.end();

            done();
        });
    });
});


describe('#getFileName()', function(){
    it('should return the default pgpass file', function(){
        var env = {
            HOME : '/tmp' ,
            APPDATA : 'C:\\tmp'
        };
        assert.equal(
            helper.getFileName(env) ,
            process.platform === 'win32' ? 'C:\\tmp\\postgresql\\pgpass.conf' : '/tmp/.pgpass'
        );
    });

    it('should return the the path to PGPASSFILE if set', function(){
        var env = {};
        var something = env.PGPASSFILE = 'xxx';
        assert.equal( helper.getFileName(env), something );
    });
});


describe('#isWin', function(){
    it('should represent the platform and can be changed', function(){
        var orgIsWin = helper.isWin;
        var test = 'something';
        var isWin = process.platform === 'win32';

        assert.equal(isWin, helper.isWin);

        helper.isWin = test;
        assert.equal(test, helper.isWin);

        helper.isWin = orgIsWin;
        assert.equal(isWin, helper.isWin);
    });
});


describe('#usePgPass()', function(){
    // http://lxr.free-electrons.com/source/include/uapi/linux/stat.h
    var testResults = {
        '0100660' : false ,
        '0100606' : false ,
        '0100100' : true ,
        '0100600' : true ,
        '0040600' : false , // is a directory
        '0060600' : false   // is a blockdevice
    };

    var org = helper.isWin; // pretend we are UNIXish for permission tests
    helper.isWin = true;
    Object.keys(testResults).forEach(function(octPerm){
        var decPerm = Number(parseInt(octPerm, 8));
        var res = testResults[octPerm];
        var msg = util.format(
            'should consider permission %s %s',
            octPerm, res ? 'secure' : 'not secure'
        );

        it(msg, function(){
            assert.equal( helper.usePgPass({ mode : decPerm }) === res , true );
        });
    });
    helper.isWin = org;

    it('should always return false if PGPASSWORD is set', function(){
        process.env.PGPASSWORD = 'some';
        assert( false === helper.usePgPass() );
        delete process.env.PGPASSWORD;
    });

    it('should always return true on windows', function(){
        var org = helper.isWin;
        helper.isWin = true;
        assert( helper.usePgPass() );
        helper.isWin = org;
    });
});


describe('#parseLine()', function(){

    it('should parse a simple line', function(){
        var res = helper.parseLine( 'host:port:dbase:user:pass' );

        assert.deepEqual(res, {
            'host'     : 'host' ,
            'port'     : 'port' ,
            'database' : 'dbase' ,
            'user'     : 'user' ,
            'password' : 'pass'
        });
    });

    it('should handle comments', function(){
        var res = helper.parseLine( '  # some random comment' );
        assert.equal(res, null);
    });

    it('should handle escaped \':\' and \'\\\' right', function(){
        /* jshint -W044 */
        var res = helper.parseLine('some\\:host:port:some\\\\database:some\;user:somepass');
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
            var res = helper.parseLine(line);
            assert.equal(null, res);
        });
    });

});


describe('#isValidEntry()', function(){
    it('shouldn\'t report valid entries', function(){
        assert(helper.isValidEntry({
            'host'     : 'some:host' ,
            'port'     : 100 ,
            'database' : 'some\\database' ,
            /* jshint -W044 */
            'user'     : 'some\;user' ,
            /* jshint +W044 */
            'password' : 'somepass'
        }));
        assert(helper.isValidEntry({
            'host'     : '*' ,
            'port'     : '*' ,
            'database' : '*' ,
            'user'     : '*' ,
            'password' : 'somepass'
        }));
    });

    it('should find invalid entries', function(){
        assert(!helper.isValidEntry({
            'host'     : ''
        }));
        assert(!helper.isValidEntry({
            'host'     : 'host' ,
            'port'     : '100' ,
            'database' : 'database' ,
            'user'     : 'user'
        }));
        assert(!helper.isValidEntry({
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

        resReturn = helper.read(fileContent, function(err, res){
            resCb = res;
        });

        assert.notEqual( resReturn, [] );
        assert.deepEqual( resReturn, resCb );
    });

    it('should handle a buffer', function(){
        var resReturn, resCb;
        var buf = new Buffer(fileContent);

        resReturn = helper.read(buf, function(err, res){
            resCb = res;
        });

        assert.notEqual( resReturn, [] );
        assert.deepEqual( resReturn, resCb );
    });

    it('should handle a stream', function(done){
        var resReturn, resCb;
        var stream = new Stream().queue(fileContent).end();

        resReturn = helper.read(stream, function(err, res){
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

        ret = helper.getPassword(conn1, creds);
        assert.equal(ret, creds[0].password);

        ret = helper.getPassword(conn2, creds);
        assert.equal(ret, creds[1].password);
    });

    it('should not return and not fill in a password', function(){
        var ret;

        ret = helper.getPassword(conn3, undefined, true);
        assert(!ret);
        assert(!conn3.password);

        ret = helper.getPassword(conn1, undefined, true);
        assert(!ret);
        assert(!conn1.password);

        ret = helper.getPassword({}, creds, true);
        assert(!ret);
    });

    it('should return and fill in a password', function(){
        var ret;

        ret = helper.getPassword(conn1, creds, true);
        assert.equal(ret, creds[0].password);
        assert.equal(conn1.password, creds[0].password);

        ret = helper.getPassword(conn2, creds, true);
        assert.equal(ret, creds[1].password);
        assert.equal(conn2.password, creds[1].password);
    });
});