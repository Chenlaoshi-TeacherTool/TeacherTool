'use strict';

// Planned membership prices shown on /membership. While `paymentsOpen` is false
// the page only announces the plans; nothing can be bought yet.
module.exports = {
  paymentsOpen: false,
  plans: [
    { key: 'half-year', days: 180, regular: 15, founding: 12 },
    { key: 'year', days: 365, regular: 24, founding: 19, recommended: true }
  ]
};
