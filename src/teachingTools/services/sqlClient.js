'use strict';

var sql = require('mssql');

var poolPromise = null;

function getPool() {
  if (!process.env.SQL_CONNECTION_STRING) {
    return Promise.reject(new Error('SQL_CONNECTION_STRING is not configured.'));
  }
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(process.env.SQL_CONNECTION_STRING).connect();
    poolPromise.catch(function () { poolPromise = null; });
  }
  return poolPromise;
}

module.exports = { getPool: getPool, sql: sql };
