# Store offer fixtures

`standalone-page.json` is page 3 of the anonymous RSI store GraphQL response recorded on 2026-10-17. It includes both Sabre Raven EX editions: standard with 6-month insurance and warbond with LTI.

The query is in `extension/background.js`: standalone product 72, 20 results per page, sorted by name ascending. No cookies or account data were recorded.

`unavailable.json` keeps the recorded Sabre Raven EX warbond, with `stock.available` changed to false to cover a sold-out offer. The live browse returned only available SKUs when recorded.
