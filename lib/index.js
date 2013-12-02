'use strict';

var path = require('path')
  , fs = require('fs')
  , PgPass = require( path.join(__dirname, 'libPgPass.js') )
;

function getPassword(file, conn, cb){
    fs.stat(file, function(err, stat){
        if (err || !PgPass.usePgPass(stat)) {
            return cb(undefined);
        }

        var st = fs.createReadStream(file);

        return PgPass.read(st, function(err, results){
            return cb(PgPass.getPassword(conn, results));
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

    if (!PgPass.usePgPass(stat)) {
        return undefined;
    }

    var content = fs.readFileSync(file);
    var results = PgPass.read(content);

    return PgPass.getPassword(conn, results);
}

module.exports = function(conn, cb) {
    var file = PgPass.getFileName();

    if ('function' === typeof cb) {
        return getPassword(file, conn, cb);
    } else {
        return getPasswordSync(file, conn);
    }
};
