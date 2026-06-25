# App Report

## Scope
This report reflects the current state of the restaurant app after the recent Supabase migration, realtime optimization passes, client/service UX cleanup, and multi-table group groundwork.

## Current assessment
- Speed score: `8.1 / 10`
- Runtime stability score: `7.5 / 10`
- Product completeness score: `8.5 / 10`
- Production readiness score for a real restaurant: `7.2 / 10`

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
- Group payment and group settlement ticket now exist in staff.

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

### 1. Some routes still fetch restaurant-wide data
Several paths are already optimized, but some views still load broad datasets and derive view-specific summaries in memory.
This is acceptable for demos and small volume, but not ideal for sustained live service.

### 2. Observability is still too light
There is not yet a strong production diagnostics layer for:
- failed API writes
- slow Supabase queries
- realtime disconnect metrics
- role/session conflict tracing

### 3. Browser-extension interference remains possible
Auto-translate or browser extensions can still mutate DOM in ways React does not like. Protection was added, but client-side browser pollution is still outside app control.

### 4. Auth model is role-cookie based
Different roles can coexist in the same browser.
Two accounts of the same role in the same browser still compete for the same cookie namespace.
That is a known limitation, not a regression.

### 5. Offline resilience is not yet fully hardened
Critical question:
- if Wi-Fi drops for 30 seconds, does service continue cleanly?

Current state:
- the UI keeps local state while the tab is open
- realtime has polling fallback
- several server writes are resilient enough not to hard-crash the screen

What is still missing:
- explicit offline queueing for critical client/staff actions
- visible offline/online banners
- retry policy with user-facing state for:
  - order submit
  - waiter validation
  - kitchen status change
  - payment registration

### 6. Conflict handling is not fully formalized
Critical question:
- if two waiters validate the same order at the same time, what is guaranteed?

Current state:
- writes are safer than before
- duplicate-open protections exist in several flows
- UI refreshes are less noisy

What is still missing:
- stricter optimistic concurrency on status transitions
- server-side idempotency keys for high-risk actions
- explicit conflict responses for:
  - double validation
  - double payment submit
  - simultaneous table reassignment

### 7. Recovery behavior needs explicit verification
Critical questions:
- if the browser closes, does the table come back?
- does the order come back?
- does the session come back?

Current state:
- auth sessions survive via cookies
- client/staff/kitchen rehydrate from server state after reload
- table sessions and orders persist in Supabase

What is still missing:
- a tested recovery matrix for:
  - client with open cart
  - client with open table session
  - staff with selected table modal
  - kitchen mid-service
- explicit UI messaging when recovery restored an existing active session

### 8. Permission testing is still a required release gate
It must be verified that:
- `client` cannot access:
  - `manager`
  - `kitchen`
  - `owner`
  - `staff`
- not only by UI
- also not by direct URL
- also not by API route

Current code already enforces role checks in many routes, but this still needs a formal test pass, not assumption.

### 9. Security validation is still incomplete as a production checklist
This must be checked explicitly:
- Supabase RLS strategy
- restaurant validation
- role validation
- session validation
- `tableId` validation
- `restaurantSlug` validation

Current state:
- app-level validation exists in many server routes
- Supabase admin access is used server-side

What is still missing:
- a documented RLS model per table
- confirmation that no client-facing path can bypass restaurant scoping
- a route-by-route security review

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
1. Offline resilience hardening
2. Stronger production logging and health monitoring
3. End-to-end test coverage for the full live service flow
4. Conflict and security validation pass

### Medium value
1. Better customer-facing payment visibility
2. More granular manager analytics
3. Cleaner role/session debugging tools
4. Admin tools for recovery / reopen flows

### Lower value for now
1. Extra visual polish
2. More theme variations
3. More notification channels before core service stability is fully hardened

## Concrete next technical steps

### Priority A
- add stricter write-path guards around payment and order transitions
- implement explicit offline-safe retry policy for critical actions
- formalize conflict handling on status/payment/table-move transitions

### Priority B
- add production logging around all operational APIs
- add structured fallback/error telemetry
- add route-level load timing logs for:
  - `/client`
  - `/staff`
  - `/kitchen`
  - `/api/restaurants/[slug]/orders`
- add role/permission regression tests for all protected routes

### Priority C
- slim remaining broad payloads
- add cached manager aggregates
- reduce repeated summary recomputation
- document and validate Supabase security model

## Real-world readiness conclusion
The app is now suitable for:
- controlled demos
- guided pilot tests
- limited real-world usage with supervision

It is not yet at the level where I would call it fully hardened for busy real service without a short stabilization sprint focused on:
- offline resilience
- conflict handling
- permission/security verification
- production diagnostics
- final high-volume flow verification

## Recommendation
If the goal is to onboard real clients as soon as possible, the correct path is:
1. finalize group payment and ticket output
2. run the critical resilience/security validation pass
3. add production observability
4. run a strict end-to-end service rehearsal
5. then launch a first supervised pilot restaurant

## Critical release checklist to add now

### Offline resilience
- test 30-second Wi-Fi cut during:
  - client order submit
  - staff validation
  - kitchen start / ready
  - payment save
- confirm operator-visible behavior for each case

### Conflict handling
- two staff validate same order
- two staff register payment on same note
- two users try to move the same table
- two clients try to join the same group with/without code

### Recovery
- close browser and reopen:
  - client with active session
  - staff on active table
  - kitchen during active prep
- verify session/order/table recovery

### Permission testing
- confirm `client` cannot open:
  - `/dashboard`
  - `/staff`
  - `/kitchen`
  - `/owner`
- confirm protected APIs reject wrong role

### Security
- review Supabase RLS strategy
- verify restaurant scoping on all role-sensitive routes
- verify slug and table validation on all operational APIs
- verify session cookie validation and guest token validation paths
