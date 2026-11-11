'use strict';

// The newest database migration (database/migrations/<id>.sql) this code needs.
// When you add a migration, set this to its id; test/dbMigrations.test.js
// checks that it matches the newest file. Admin pages warn while the
// database is behind, i.e. the migration was not run before deploying.
module.exports = {
  requiredMigration: '0016_add-theme-order'
};
