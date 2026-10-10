# PrivseAI Marketplace and Creator Dashboard — Design Plan
**Status:** Phase 0 (entry page/menu) implemented. No NFT minting, paid checkout, or creator payouts are enabled yet.

## Product boundary
- **privseai.com — consumer marketplace:** discover creator assets, preview rights and provenance, download or receive content, and later purchase an edition.
- **muhanai.com — creator/operations dashboard:** creator onboarding, listing management, moderation, sales, royalties/payouts, disputes, and operational telemetry. Keep this as a separate app/API surface with its own roles. The MuhanAI dashboard repository was not available in this checkout.
- Both apps may use a shared backend, but they must use separate least-privilege sessions/scopes.

## Asset/catalog model
Each listing should have a stable ID, creator ID, asset kind (`image`, `video`, `character`, `model`), title/description, preview, SHA-256, byte size, MIME type, version, tags, content rating, license grant, distribution policy, and publication state. Never infer adult status from filenames. Store provenance/license evidence and a moderation decision. Reject executable files and enforce upload limits.

## Delivery and P2P
1. Upload to a quarantine/staging bucket; validate MIME/size, scan, compute digest, and moderate.
2. Publish catalog metadata only after approval. Include the immutable digest and rights summary in P2P announcements.
3. Transfer large media as authenticated, bounded chunks with per-chunk hashes, resume support, peer rate limits, and a server/object-storage fallback. Trystero's current small-data actions are not a large-file transfer protocol.
4. Public assets may be cached and P2P-seeded. Paid assets should be encrypted at rest/in transit; verify entitlement before issuing short-lived decryption authorization. P2P cannot prevent a buyer from copying plaintext after access.
5. Do not put private source files, private URLs, user identity, or secrets on-chain/IPFS metadata.

## NFT/commerce phases
- **Phase 0:** Marketplace entry/menu and truthful status page (implemented here).
- **Phase 1:** Free catalog, creator profiles, rights/provenance display, report/takedown flow.
- **Phase 2:** Wallet linking/signatures and testnet minting of ERC-721 unique items / ERC-1155 editions; audit contract and metadata immutability strategy.
- **Phase 3:** Production listings and checkout. A server is authoritative for prices, orders, payment webhooks, refunds/chargebacks, buyer entitlements, and creator payouts/KYC. Never trust a client claim that payment succeeded.
- **Phase 4:** P2P chunk transport, encrypted paid-asset delivery, revocation/takedown tooling, abuse monitoring.

NFT ownership is not copyright transfer. Every listing must state the exact personal/commercial/reproduction rights granted. Royalties on secondary sales are marketplace-dependent and cannot be promised unless enforced by the actual venue/contract. Obtain legal, tax, privacy, and smart-contract review before production payments.

## Integration notes
- Existing `AIPackage`/media metadata and `AIHub.sharePackage()` can seed the free catalog, but sanitize stock assets and preserve licenses.
- Existing `/billing/checkout?plan=...` is subscription-oriented; do not reuse it as an asset checkout until server order/webhook semantics exist.
- `server-prompt-api.ts` can suggest prompts/tags only after explicit user consent; it is not a payment, moderation, or video-analysis API.
- Keep admin/moderation and payout actions on the MuhanAI dashboard/backend, never in the public client bundle.
