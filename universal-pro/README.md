# NEW CITY STYLE Universal Pro — isolated Android prototype

**Separate native Android package:** `store.newcitystyle.universalpro`.

- Kotlin / Jetpack Compose screens; no WebView and no external website links.
- **Prototype only:** All dashboard amounts are illustrative placeholders, not live financial data.
- **Zero permissions, zero API calls, zero financial writes.** No access to existing billing database or credentials.
- The existing Android Billing, Web Store and Desktop POS stay untouched.
- GitHub Actions workflow builds a separate debug APK as an artifact when enabled.
- Before connecting real data: audit both supplied source ZIPs, map every feature, add Room with migration tests, design an authenticated read-only bridge, and test sync idempotency on a separate sandbox.

Development build: from `universal-pro`, `gradle :app:assembleDebug`.
