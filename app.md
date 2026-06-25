# App Report

## Scope
This report reflects the current state of the restaurant app after the recent Supabase migration, realtime optimization passes, client/service UX cleanup, and multi-table group groundwork.

## Current assessment
- Speed score: `7.8 / 10`
- Runtime stability score: `7.2 / 10`
- Product completeness score: `8.1 / 10`
- Production readiness score for a real restaurant: `6.9 / 10`

These scores are engineering estimates, not lab benchmarks.

## What is already done

### Core product flows
- Public restaurant pages work for demo restaurants.
- Client portal supports:
  - authenticated clients
  - anonymous guests
  - table confirmation
  - cart and order submit
  - service tracking
  - bill split basics
- Staff supports:
  - table selection
  - QR order validation
  - server calls
  - moving a session from one table to another
  - reservation handling
  - payment registration
- Kitchen supports:
  - order pickup
  - preparation
  - ready state
  - server handoff
- Manager supports:
  - dashboard
  - menu management
  - reservations
  - settings
  - audit

### Persistence
- Main operational stores are on Supabase.
- Seed/backfill logic exists for demo restaurants and demo users.
- Core local JSON persistence has been replaced for the main runtime paths.

### Performance work already completed
- Realtime refreshes are coalesced.
- Hidden tabs stop fallback polling.
- Realtime refresh is now granular by event type.
- Several store reads were optimized to use filtered Supabase queries instead of loading full datasets.
- Kitchen now requests a smaller orders payload.

### UX work already completed
- Client `Service` tab now hides advanced controls by default.
- Table selection and group access code are no longer shown as primary UI.
- Client service statuses are now human-readable instead of technical.
- Group table groundwork exists with access codes and shared session logic.

## What works well now
- Main happy-path demo works across:
  - client
  - staff
  - kitchen
  - manager
- Demo restaurant `food-1` is now restored with categories, dishes, images, details and tables.
- Table locking is safer: once a client confirms a table, they cannot change it themselves.
- Shared table/group access is no longer implicit; it requires an access code.
- Staff can move the active note and consumption from one table to another.

## What still limits real-world readiness

### 1. Group payment is not finished
What exists now:
- table groups
- access code join
- per-table and per-person summaries

What is still missing:
- payment directly at group level
- proper shared bill settlement across several tables in one action
- invoice/ticket generation for a group

### 2. Some routes still fetch restaurant-wide data
Several paths are already optimized, but some views still load broad datasets and derive view-specific summaries in memory.
This is acceptable for demos and small volume, but not ideal for sustained live service.

### 3. Observability is still too light
There is not yet a strong production diagnostics layer for:
- failed API writes
- slow Supabase queries
- realtime disconnect metrics
- role/session conflict tracing

### 4. Browser-extension interference remains possible
Auto-translate or browser extensions can still mutate DOM in ways React does not like. Protection was added, but client-side browser pollution is still outside app control.

### 5. Auth model is role-cookie based
Different roles can coexist in the same browser.
Two accounts of the same role in the same browser still compete for the same cookie namespace.
That is a known limitation, not a regression.

## Speed and performance analysis

### What is good
- Backend reads are materially better than before.
- Realtime churn is lower.
- Kitchen is lighter than before.
- Client and staff now do fewer redundant refreshes.

### What is still improvable
- More route-level payload slimming for:
  - staff orders
  - manager summaries
  - group summary paths
- More server-side denormalized counters for dashboard cards.
- Optional caching for read-mostly restaurant/menu payloads beyond the current short-term in-memory cache.
- Better batching of related client/staff refresh requests.

## What would increase value fastest

### High value
1. Group payment completion
2. Printable ticket / invoice flow
3. Stronger production logging and health monitoring
4. End-to-end test coverage for the full live service flow

### Medium value
1. Per-person settlement UX in staff
2. Better customer-facing payment visibility
3. More granular manager analytics
4. Cleaner role/session debugging tools

### Lower value for now
1. Extra visual polish
2. More theme variations
3. More notification channels before core service stability is fully hardened

## Concrete next technical steps

### Priority A
- finish group payment flow
- generate ticket / invoice from group or table session
- add stricter write-path guards around payment and order transitions

### Priority B
- add production logging around all operational APIs
- add structured fallback/error telemetry
- add route-level load timing logs for:
  - `/client`
  - `/staff`
  - `/kitchen`
  - `/api/restaurants/[slug]/orders`

### Priority C
- slim remaining broad payloads
- add cached manager aggregates
- reduce repeated summary recomputation

## Real-world readiness conclusion
The app is now suitable for:
- controlled demos
- guided pilot tests
- limited real-world usage with supervision

It is not yet at the level where I would call it fully hardened for busy real service without a short stabilization sprint focused on:
- group payment
- ticket/invoice output
- production diagnostics
- final high-volume flow verification

## Recommendation
If the goal is to onboard real clients as soon as possible, the correct path is:
1. finalize group payment and ticket output
2. add production observability
3. run a strict end-to-end service rehearsal
4. then launch a first supervised pilot restaurant
