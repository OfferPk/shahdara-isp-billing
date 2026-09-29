# Shahdara ISP Billing

A phone-friendly, offline-ready ISP customer billing ledger. The app is a static website: customer edits, mohallas, bill status, and payments are saved in local browser storage on the device in use. There is no account, backend, or automatic synchronization. Export TXT files to keep a separate backup or share a statement.

**The starter customer names in this public repository and public preview are visible to anyone. Billing entries are not included in the repository or sent to a server; they remain in the browser on the device where they are entered.**

- **Browser app:** https://offerpk.github.io/shahdara-isp-billing/
- **Source:** https://github.com/OfferPk/shahdara-isp-billing

## Included

- Exact supplied starter customer list, with an initially empty billing ledger.
- Add and delete customers; record a customer's mohalla.
- Up to 24 months of bill status and optional bill amount per customer.
- Multiple real payments per month with date, amount, and method (Cash, JazzCash, Easypaisa, or Bank Transfer); correct a recorded payment later.
- TXT export for all payment details and an individual customer's billing history.
- Service-worker caching for offline use after the first visit.
- Capacitor Android wrapper that bundles the static app; billing entries remain local to the installed app on that device.

No bill amounts, mohallas, payments, payment history, or other sample records are prefilled.

## Run locally

Serve this directory over localhost (service workers require localhost or HTTPS), for example:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080` in a modern browser. Run tests with:

```sh
npm test
```

## Build static site and Android app

```sh
npm install
npm run build
npm run android:sync
npm run android:debug
```

The site build places only app assets in `dist/`. The Android project bundles those assets into the app; it does not fetch billing data from the public website. The generated Android debug APK is signed with Android's debug key for direct installation/testing; this signing key is not for Play Store publication or seamless future app updates under a separate release key.
