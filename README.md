# Shahdara ISP Billing

A phone-friendly, offline-ready ISP customer billing ledger. The app is a static website: customer edits, mohallas, bill status, and payments are saved in local browser storage on the device in use. There is no account, backend, or automatic synchronization. Export TXT files to keep a separate backup or share a statement.

**The starter customer names in this public repository and public preview are visible to anyone. Billing entries are not included in the repository or sent to a server; they remain in the browser on the device where they are entered.**

## Included

- Exact supplied starter customer list, with an initially empty billing ledger.
- Add and delete customers; record a customer's mohalla.
- Up to 24 months of bill status and optional bill amount per customer.
- Multiple real payments per month with date, amount, and method (Cash, JazzCash, Easypaisa, or Bank Transfer); correct a recorded payment later.
- TXT export for all payment details and an individual customer's billing history.
- Service-worker caching for offline use after the first visit.

No bill amounts, mohallas, payments, payment history, or other sample records are prefilled.

## Run locally

Serve this directory over localhost (service workers require localhost or HTTPS), for example:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080` in a modern browser. Run the model and export tests with:

```sh
npm test
```

## Build static preview assets

```sh
npm run build
```

The build places only the app's static files in `dist/`; tests and repository notes are not part of the hosted site.
