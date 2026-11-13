# Vendored runtime for the report template

Pinned copies of the scripts `support.js` would otherwise load from unpkg. They are byte-identical to the
published packages; the SHA-384 hashes match the SRI values hard-coded in `support.js`.

| File | Package | SHA-384 (same as `support.js`) |
| --- | --- | --- |
| `react.production.min.js` | react@18.3.1 `umd/react.production.min.js` | `DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z` |
| `react-dom.production.min.js` | react-dom@18.3.1 `umd/react-dom.production.min.js` | `gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1` |
| `babel.min.js` | @babel/standalone@7.29.0 `babel.min.js` | `m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y` |

The template maps the unpkg URLs to these files through `window.__resources` (a hook `support.js` already has).
A unit test in `web/` re-checks the hashes. Verify by hand with:

```bash
openssl dgst -sha384 -binary react.production.min.js | openssl base64 -A
```
