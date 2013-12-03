'use strict';

var path = require('path')
  , fs = require('fs')
  , helper = require( path.join(__dirname, 'helper.js') )
;

function getPassword(file, conn, cb){
    fs.stat(file, function(err, stat){
        if (err || !helper.usePgPass(stat)) {
            return cb(undefined);
        }

        var st = fs.createReadStream(file);

        return helper.read(st, function(err, results){
            return cb(helper.getPassword(conn, results));
        });
    });
}

function getPasswordSync(file, conn){
    var stat;
    try {
        stat = fs.statSync(file);
    } catch (x) {
        return undefined;
    }

    if (!helper.usePgPass(stat)) {
        return undefined;
    }

    var content = fs.readFileSync(file);
    var results = helper.read(content);

    return helper.getPassword(conn, results);
}

module.exports = function(conn, cb) {
    var file = helper.getFileName();

    if ('function' === typeof cb) {
        return getPassword(file, conn, cb);
    } else {
        return getPasswordSync(file, conn);
    }
};
