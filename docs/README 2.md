# VolSpike Documentation Index

**Last Updated:** December 2025

This directory contains organized technical documentation for the VolSpike project. For AI assistant guidance, see the root-level files: [CLAUDE.md](../CLAUDE.md), [AGENTS.md](../AGENTS.md), and [OVERVIEW.md](../OVERVIEW.md).

---

## Quick Navigation

### For New Contributors
1. Start with [OVERVIEW.md](../OVERVIEW.md) - High-level project overview
2. Read [AGENTS.md](../AGENTS.md) - Complete architecture and guidelines
3. Check [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) - Current roadmap
4. Review [CLAUDE.md](../CLAUDE.md) - AI assistant guide

### For Deployment
- [Deployment Checklist](../DEPLOYMENT_CHECKLIST.md) - Pre-production verification
- [OI Realtime Deployment](deployment/oi-realtime-deployment.md) - Digital Ocean setup
- [Quick Start Proxy](deployment/quick-start-proxy.md) - Binance proxy configuration

### For Testing
- [Asset Sync Testing](testing/asset-sync-testing.md) - Comprehensive asset management tests
- [Payment Testing](testing/payment-testing-quick-guide.md) - Quick crypto payment troubleshooting

### For Troubleshooting
- [Auth Race Condition Fix](troubleshooting/auth-race-condition-fix.md)
- [Asset Enrichment Optimization](troubleshooting/asset-enrichment-optimization.md)
- [Binance Sync Debug](troubleshooting/binance-sync-debug.md)
- [Payment Timer Fix](troubleshooting/payment-timer-fix.md)

---

## Documentation Structure

### `/admin` - Admin Features
Documentation for admin panel features and operations.

- [asset-management-ui.md](admin/asset-management-ui.md) - Asset management interface guide
- [asset-sync-implementation.md](admin/asset-sync-implementation.md) - Asset sync system implementation
- [asset-enrichment-guide.md](admin/asset-enrichment-guide.md) - Asset enrichment and CLI backfill guide
- [asset-pagination-fix.md](admin/asset-pagination-fix.md) - Asset table pagination fix documentation
- **`/payments`**
  - [complete-partial-payment.md](admin/payments/complete-partial-payment.md) - Handling partial crypto payments

### `/asset-enrichment` - Asset Metadata System
Legacy documentation for the asset enrichment system (consider consolidating with `/admin`).

- [Requirements.md](asset-enrichment/Requirements.md)
- [Design.md](asset-enrichment/Design.md)
- [TESTING_GUIDE.md](asset-enrichment/TESTING_GUIDE.md)
- [MANIFEST_CACHE_TROUBLESHOOTING.md](asset-enrichment/MANIFEST_CACHE_TROUBLESHOOTING.md)
- [ToDo.md](asset-enrichment/ToDo.md)

### `/binance_websocket_funding` - Funding Rate WebSocket
Documentation for the Binance funding rate WebSocket integration (Digital Ocean).

- [README.md](binance_websocket_funding/README.md) - Overview
- [requirements.md](binance_websocket_funding/requirements.md)
- [design.md](binance_websocket_funding/design.md)
- [implementation_steps.md](binance_websocket_funding/implementation_steps.md)
- [DEPLOYMENT.md](binance_websocket_funding/DEPLOYMENT.md)
- [IMPLEMENTATION_LOG.md](binance_websocket_funding/IMPLEMENTATION_LOG.md)
- [CHECK_VALIDATION_RESULTS.md](binance_websocket_funding/CHECK_VALIDATION_RESULTS.md)
- [PING_PONG_TIMEOUT_ISSUE.md](binance_websocket_funding/PING_PONG_TIMEOUT_ISSUE.md)

### `/deployment` - Deployment Guides
Step-by-step deployment instructions for various components.

- [oi-realtime-deployment.md](deployment/oi-realtime-deployment.md) - Deploy OI realtime poller to Digital Ocean
- [quick-start-proxy.md](deployment/quick-start-proxy.md) - Set up Binance proxy on Digital Ocean (5-minute version)
- [binance-proxy-setup.md](deployment/binance-proxy-setup.md) - Comprehensive Binance proxy setup guide

### `/design` - Design Specifications
UI/UX design documents and redesign proposals.

- [profile-menu-redesign.md](design/profile-menu-redesign.md) - Profile dropdown redesign spec (not yet implemented)

### `/features` - Feature Documentation
Documentation for major features, organized by feature.

- [tier-features-reference.md](features/tier-features-reference.md) - Comprehensive tier features documentation
- [watchlist-alerts.md](features/watchlist-alerts.md) - Watchlist and alert creation features
- **`/rss-news-feed`**
  - [README.md](features/rss-news-feed/README.md)
  - [requirements.md](features/rss-news-feed/requirements.md)
  - [design.md](features/rss-news-feed/design.md)
  - [implementation_steps.md](features/rss-news-feed/implementation_steps.md)

### `/oi_realtime` - Open Interest Realtime Feature
Documentation for the realtime Open Interest tracking system.

- [requirements.md](oi_realtime/requirements.md)
- [design.md](oi_realtime/design.md)
- [implementation_steps.md](oi_realtime/implementation_steps.md)

### `/payments` - Payment System
Documentation for Stripe and crypto payment integrations.

- [realtime-status-system.md](payments/realtime-status-system.md) - Real-time payment status updates
- [phantom-wallet-setup.md](payments/phantom-wallet-setup.md) - Phantom wallet integration guide
- [solana-pay-guide.md](payments/solana-pay-guide.md) - Solana Pay integration documentation
- [crypto-recommendations.md](payments/crypto-recommendations.md) - NowPayments vs custom solution analysis

### `/testing` - Testing Guides
Comprehensive testing documentation for various systems.

- [asset-sync-testing.md](testing/asset-sync-testing.md) - Full asset sync testing guide (630 lines)
- [payment-testing-quick-guide.md](testing/payment-testing-quick-guide.md) - Quick payment troubleshooting

### `/troubleshooting` - Problem Solving Guides
Solutions to known issues and debugging guides.

- [auth-race-condition-fix.md](troubleshooting/auth-race-condition-fix.md) - JWT callback race condition fix
- [asset-enrichment-optimization.md](troubleshooting/asset-enrichment-optimization.md) - Asset enrichment performance
- [binance-sync-debug.md](troubleshooting/binance-sync-debug.md) - Debug Binance asset sync errors
- [payment-timer-fix.md](troubleshooting/payment-timer-fix.md) - Crypto payment timer freeze fix

### `/watchlist-feature` - Watchlist System
Legacy documentation for watchlist feature (consider consolidating with `/features`).

- [Requirements.md](watchlist-feature/Requirements.md)
- [Design.md](watchlist-feature/Design.md)
- [DATABASE_MIGRATION.md](watchlist-feature/DATABASE_MIGRATION.md)
- [TESTING.md](watchlist-feature/TESTING.md)
- [ToDo.md](watchlist-feature/ToDo.md)

---

## Documentation Maintenance Notes

### Status Indicators
Docs should include status information:
- **Active** - Currently maintained, reflects production
- **Draft** - Work in progress
- **Deprecated** - Superseded by newer docs
- **Historical** - Archived for reference

### Consolidation Opportunities
The following directories could be consolidated:
1. `/asset-enrichment` → merge with `/admin` (same topic)
2. `/watchlist-feature` → merge with `/features/watchlist-alerts.md`
3. Legacy feature folders → standardize to `/features/NAME/` format

### Cross-References
Key docs that reference each other:
- `CLAUDE.md` → `AGENTS.md`, `OVERVIEW.md`, `IMPLEMENTATION_PLAN.md`
- `AGENTS.md` → Central reference for all implementation details
- `IMPLEMENTATION_PLAN.md` → Current state and roadmap

---

## Contributing to Documentation

### Adding New Documentation
1. Choose the appropriate category (`/admin`, `/features`, `/troubleshooting`, etc.)
2. Use the `/implement` Claude command for new features (generates structure automatically)
3. Include clear titles, last updated date, and status
4. Cross-reference related docs
5. Update this index

### Documentation Standards
- Use markdown format
- Include table of contents for long docs (> 100 lines)
- Add code examples where appropriate
- Mark deprecated content clearly
- Keep file names lowercase with hyphens (kebab-case)

### Review Cadence
- Quarterly review of all docs
- Update after major feature changes
- Remove outdated content promptly
- Archive historical docs rather than deleting

---

## Related External Documentation

- **Next.js Docs:** https://nextjs.org/docs
- **Hono Framework:** https://hono.dev/
- **Prisma ORM:** https://www.prisma.io/docs
- **NextAuth.js v5:** https://authjs.dev/
- **Binance API:** https://binance-docs.github.io/apidocs/futures/en/

---

**For questions or updates to this index, contact the project maintainer or submit a PR.**
