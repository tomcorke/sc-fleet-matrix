# Hangar fixtures

Each file is one real `.list-items > li` from the `/en/account/pledges` listing, read on 2026-10-17 with the owner's RSI sign-in, then reduced by hand-written rules: images, URLs, dates, scripts, upgrade data, the availability label, other hidden inputs and utility classes are removed, and the pledge ID is replaced by a dummy (1001 to 1005). Titles, kinds, USD melt values, currency strings and action links are as RSI served them. The listing HTML was read over a same-origin fetch; nothing was changed in the account.

| File                      | Source pledge                                | Ship         | Melt value  | Insurance (in order)                      | Flags                                                                                                   |
| ------------------------- | -------------------------------------------- | ------------ | ----------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `single-ship-lti.html`    | Standalone Ships - Aurora Mk II plus Modules | Aurora Mk II | $55.00 USD  | Lifetime                                  | gift, exchange                                                                                          |
| `multiple-insurance.html` | Standalone Ships - MTC                       | Asgard       | $290.00 USD | Lifetime, 120 Month, 120 Month, 120 Month | exchange, upgrade log, `upgraded`                                                                       |
| `game-package.html`       | VIP High Admiral                             | none         | $0.00 USD   | none                                      | `SC Game Access` lock; "Star Citizen Digital Download" item has no `.kind`                              |
| `upgraded-pledge.html`    | Digital Scout - LTI                          | Galaxy       | $355.00 USD | Lifetime, 120 Month                       | upgrade log, `upgraded`, `SQ42 Game Access` lock; no gift or exchange; digital download without `.kind` |
| `no-ships.html`           | Polaris - 2955 Best in Show Winner Reward    | none         | $0.00 USD   | none                                      | no actions; only a `FPS Equipment` item                                                                 |

## Limits

- The hangar has no months-only insurance pledge, so `multiple-insurance.html` mixes Lifetime and 120 Month items.
- That pledge is also marked upgraded (upgrade-log link, `upgraded` classes), as is `upgraded-pledge.html`. The upgrade log itself was empty in the page, so no upgrade details are captured.
- `game-package.html` has no ship; the only pledge with a ship and a Star Citizen Digital Download is `upgraded-pledge.html`.
- `js-pledge-currency` is "Store Credit" on most pledges but "TyCustomer_ledger_-en" on the game package; both are real values.
- The hangar's Gift button is absent on upgraded pledges.
- The fixtures are kept readable, not byte-for-byte RSI markup: whitespace is re-indented and the `trans-*`, `dark`, `clearfix`, `more` and `js-more` classes are dropped.
