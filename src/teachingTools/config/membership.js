'use strict';

var DAY_MS = 24 * 60 * 60 * 1000;

// Planned membership prices shown on /membership. While `paymentsOpen` is false
// the page only announces the plans; nothing can be bought yet.
//
// Free vs member follows one rule: tools that run in the teacher's browser are
// free; features that keep files or data on the server are where membership
// applies. Students opening a shared link never need an account.
//
// `limitsEnabled` turns those limits on. Leave it false until teacher accounts
// are open, so nobody is limited before they can become a member; while it is
// false every shared link keeps the original 90-day lifetime.
//
// Buying (manual for now): the teacher pays the founding price through PayPal,
// writes their teacher-account email in the payment note, and receives an
// activation code made at /admin/memberships. Refunds within `refundDays`
// deactivate that code there.
//
// Founding prices apply to teachers who join within `foundingMonths` of sales
// opening. When opening sales, set `paymentsOpen: true` and `foundingEndsAt` to
// that date plus three months (e.g. '2027-02-15') so the page can show it.
module.exports = {
  paymentsOpen: false,
  limitsEnabled: process.env.MEMBERSHIP_LIMITS_ENABLED === 'true',
  paypalMe: 'https://paypal.me/chenlaoshitoolkit',
  foundingMonths: 3,
  foundingEndsAt: null,
  graceDays: 30,
  refundDays: 3,
  plans: [
    { key: 'half-year', days: 180, regular: 15, founding: 12 },
    { key: 'year', days: 365, regular: 24, founding: 19, recommended: true }
  ],
  shareLifetimeMs: {
    legacy: 90 * DAY_MS,
    free: 7 * DAY_MS,
    member: 180 * DAY_MS
  }
};
