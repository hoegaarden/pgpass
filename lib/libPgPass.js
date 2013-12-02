'use strict';

var path = require('path')
  , Stream = require('stream').Stream
  , Split = require('split')
  , isWin = (process.platform === 'win32')
  , defaultPort = 5432
;

Object.defineProperty(module.exports, 'isWin', {
    get : function() {
        return isWin;
    } ,
    set : function(val) {
        isWin = val;
    }
});


var fieldNames = [ 'host', 'port', 'database', 'user', 'password' ];
var nrOfFields = fieldNames.length;

module.exports.getFileName = function(env){
    env = env || process.env;
    var file = env.PGPASSFILE || (
        isWin ?
          path.join( env.APPDATA , 'postgresql', 'pgpass.conf' ) :
          path.join( env.HOME, '.pgpass' )
    );
    return file;
};

module.exports.usePgPass = function(stats) {
    var binMode = ( stats.mode || 511 ).toString(8);

    return (
        !process.hasOwnProperty('PGPASSWORD') && (
            isWin || binMode.substr(-2) === '00'
        )
    );
};

module.exports.read = function(input, cb) {
    var isStream = (input instanceof Stream && input.readable === true);
    var isBuffer = Buffer.isBuffer(input);
    var results = [];

    var func = isStream ? handleStream : (
        isBuffer ? handleBuffer : handleString
    );

    return func(input);

    function addLine(line) {
        var entry = parseLine(line);
        if (entry && isValidEntry(entry)) {
            results.push(entry);
        }
    }

    function handleString(str) {
        str.split(/\n\r?/).forEach(addLine);
        if (typeof cb === 'function') {
            cb(null, results);
        }
        return results;
    }

    function handleBuffer(buf) {
        return handleString(buf.toString());
    }

    function handleStream(stream) {
        stream.pipe(new Split())
          .on('data', addLine)
          .on('end', cb.bind(null, null, results))
          .on('error', cb.bind(null, null, results)) // ignore errors
        ;

        return null;
    }
};

var parseLine = module.exports.parseLine = function(line) {
    if (line.length < 11 || line.match(/^\s+#/)) {
        return null;
    }

    function addToObj(idx, i0, i1) {
        if (idx >= 0 && idx < nrOfFields) {
            obj[ fieldNames[idx] ] = line
                                     .substring(i0, i1)
                                     .replace(/\\([:\\])/, '$1')
            ;
            return true;
        } else {
            return false;
        }
    }

    var prevChar = '';
    var curChar = '';
    var startIdx = 0;
    var obj = {};
    var fieldIdx = 0;
    var isOk = false;

    for (var i = 0 ; i < line.length-1 ; i += 1) {
        curChar = line.charAt(i+1);
        prevChar = line.charAt(i);

        if (i >= 0 && curChar == ':' && prevChar !== '\\') {
            if ( ! addToObj(fieldIdx, startIdx, i+1) ) {
                return null;
            }

            startIdx = i+2;
            fieldIdx += 1;
        }
    }
    isOk = addToObj(fieldIdx, startIdx);

    return (
        isOk &&
          Object.keys(obj).length === nrOfFields
    ) ? obj : null;
};


var isValidEntry = module.exports.isValidEntry = function(entry){
    var rules = {
        // host
        0 : function(x){
            return x.length > 0;
        } ,
        // port
        1 : function(x){
            if (x === '*') {
                return true;
            }
            x = Number(x);
            return (
                isFinite(x) &&
                  x > 0 &&
                  x < 9007199254740992 &&
                  Math.floor(x) === x
            );
        } ,
        // database
        2 : function(x){
            return x.length > 0;
        } ,
        // username
        3 : function(x){
            return x.length > 0;
        } ,
        // password
        4 : function(x){
            return x.length > 0;
        }
    };

    for (var idx = 0 ; idx < fieldNames.length ; idx += 1) {
        var rule = rules[idx];
        var value = entry[ fieldNames[idx] ] || '';

        var res = rule(value);
        if (!res) {
            return false;
        }
    }

    return true;
};


module.exports.getPassword = function(input, creds, add){
    input = input || {};
    creds = creds || [];

    var matches = function(cred){
        return fieldNames.slice(0, -1).reduce(function(prev, field, idx){
            if (idx == 1) {
                // the port
                if ( Number( input[field] || defaultPort ) === Number( cred[field] ) ) {
                    return prev && true;
                }
            }
            return prev && (
                cred[field] === '*' ||
                  cred[field] === input[field]
            );
        }, true);
    };

    for (var credIdx = 0 ; credIdx < creds.length ; credIdx += 1) {
        var cred = creds[credIdx];

        if (matches(cred)) {
            var name = fieldNames[ nrOfFields - 1 ];
            var pass = cred[ name ];

            if (add) {
                input[ name ] = pass;
            }

            return pass;
        }
    }

    return undefined;
};
