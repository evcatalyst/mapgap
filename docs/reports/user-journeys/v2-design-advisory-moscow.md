# MapGap / Nagar V2 Design Advisory Review

Date: 2026-07-10

Scope: current `/v2` public demo, mobile-first field use, browser regression behavior, and next-stage user journeys for economic development, real estate, and corporate relocation. The stakeholder journeys below are synthesized personas for product planning; they should be validated with real interviews before being treated as market evidence.

## 1. Overall Impression

`/v2` is now pointed in the right direction: it feels like a public field demo rather than a GIS workbench. The biggest remaining opportunity is to make every state preserve map context while turning the drawer into a compact evidence surface, not a second app stacked on top of the map.

## 2. Key Strengths

- The first-load experience is understandable: map, brand, status, and one clear `Explore Nearby` action.
- The bottom drawer pattern matches how people already use mobile map products.
- Service points, source badges, reset, and heatmap toggles create a credible access-evidence loop.
- The current implementation correctly separates public `/v2` from the more complex admin/workbench surface.
- Live backend regression now confirms the demo is not just frontend theater: service points and Valhalla routing both work on the deployed site.

## 3. Main Issues & Friction Points

- Visual hierarchy is still fragile on real mobile browser chrome. Bottom browser controls can obscure the FAB, drawer actions, and export/reset controls if vertical space is not managed aggressively.
- The drawer can still feel taller than the decision requires. Category cards and warning blocks should stay dense, especially after results are loaded.
- Source and caveat messages are useful, but they can dominate the evidence area. Warnings should collapse into tiny trust signals unless they require action.
- The current flow supports daily-life discovery, but it does not yet support a stakeholder arriving with a business question like "Is this site viable for workers?" or "Do we need another facility?"
- Custom category search is valuable, but it needs guardrails so a user understands that it is provider search, not a guaranteed official dataset.
- Browser back now closes and restores drawer stages before route navigation. The remaining risk is preserving that behavior as new `/v2` workflows are introduced.

## 4. Specific Recommendations

- Keep `/v2` mobile-first and evidence-first: category -> points -> list/detail -> optional access area.
- Use compact category rows or chips by default. Reserve larger cards for onboarding or empty states.
- Treat warnings as progressive disclosure:
  - badge-level: `Google backup`;
  - one-line note in summary;
  - full caveat only in detail/evidence export.
- Add a visible `Reset` or `Start over` action in every non-empty drawer state.
- Preserve the implemented shareable URL contract for category, custom query, and bounds. Add selected point or heatmap mode only when sharing those states proves useful in field tests.
- Make back behavior predictable: first close detail, then collapse results, then close drawer, then leave route.
- For desktop, avoid restoring dashboard clutter. Use the extra width for an evidence side sheet or comparison panel only after the user asks for more detail.
- For accessibility, keep 44 px touch targets, support reduced motion, ensure map controls and drawer actions are keyboard reachable, and avoid relying on color alone for access status.

## 5. Quick Wins

- Keep the shortened mobile FAB label while retaining `Explore Nearby` as the accessible name.
- Add regression assertions for no horizontal overflow across narrow iPhone, standard iPhone, Pro Max, and landscape.
- Keep reset in the drawer header, and consider a second reset action near empty/error states.
- Collapse repeated caveats into a single source badge with an info affordance.
- Add a "Search this area again" control after a user pans the map with results loaded.
- Rename generic "Export" in detail states to "Export places" or "Export evidence" depending on scope.

## 6. Longer-Term Opportunities

- Relocation household journey: compare candidate neighborhoods by commute, daily errands, school access, family anchors, and healthcare constraints.
- Economic development asset audit: compare existing public assets, service reach, utilization, and proposed investment gaps.
- Real estate/site selection: score parcels or properties by customer access, workforce reach, amenities, transit, and friction flags.
- Corporate relocation: help an employer explain practical access tradeoffs to a relocating employee or incoming team.
- Congressional/grant review: create an evidence memo showing existing assets, who can reach them, what remains underserved, and whether new capital spending duplicates capacity.
- LLM usage should be an advanced parser/search layer, not the source of truth. It can translate plain language into structured categories, constraints, and report prose, while all evidence remains sourced from POI/open-data/routing layers.

## 7. Open Questions / Risks

- Which open-data library endpoints are authoritative enough for public demos in NY and NJ, and how often do they update?
- What result quality threshold is acceptable before Google Places fallback becomes misleading?
- How should access heatmaps communicate uncertainty without overwhelming a nontechnical user?
- Will Valhalla NY/NJ coverage and cost profile remain stable under public sharing?
- What is the first paid user: relocating household, employer, economic development office, real estate analyst, or legislative staff?
- Which reports must be exportable in Stage 2: consumer shortlist, site-screen memo, asset audit memo, or grant challenge memo?

## Current UX Journeys Reviewed

### Journey A: First-Time Public Daily-Life Search

User opens `/v2`, pans the map, taps `Explore Nearby`, selects `Laundry`, sees points, source labels, and optional access rings.

Design read: This is the cleanest current demo. It proves "nearby is not always easy to reach" without needing a sales explanation.

MoSCoW:
- Must: one primary action, category selection, viewport-bounded POIs, source badges, reset, no horizontal overflow.
- Should: compact warnings and preserve the implemented `Search this area` and shareable URL behavior.
- Could: saved favorite places, compare two towns.
- Won't now: full household scoring.

### Journey B: Custom Category Search

User opens the drawer and searches for a category like `dog parks`, `pharmacies`, or `daycare`.

Design read: This is important because it lets users bring their own context, but it should feel like provider search, not a formal dataset catalog.

MoSCoW:
- Must: search input, normalized markers/list/detail, source badge, empty state.
- Should: examples, query cleanup, result type caveat.
- Could: user-created saved category.
- Won't now: arbitrary open-data connector UI.

### Journey C: Heatmap Evidence

User selects a category, turns on `Walk` or `Drive`, and sees practical reach around points.

Design read: This is the product's differentiator. It should be lazy and quiet because routing is expensive and cognitively heavier than plotting points.

MoSCoW:
- Must: POIs render before heatmap, bounded parallel routing, clear unavailable state.
- Should: progress indicator, capped point count notice, source/routing caveat in export.
- Could: compare walk vs drive in one evidence view.
- Won't now: full multimodal transit routing.

### Journey D: Reset / Recovery

User gets lost in a drawer or result set and taps reset, or refreshes the page to recover.

Design read: Reset is essential for public sharing. A demo user should never feel trapped.

MoSCoW:
- Must: reset visible in all active result states, refresh restores URL-backed searches, and reset clears stale results and heatmaps.
- Should: undo last search.
- Could: restore last view after refresh with a prompt.
- Won't now: account-based saved sessions.

## Suggested Stakeholder Journeys

### Economic Development: Workforce Access Audit

As a workforce or economic development staffer, I want to see whether residents can reach training sites, jobs, libraries, childcare, and transit without assuming straight-line proximity, so I can justify program placement and avoid duplicating underused assets.

MoSCoW:
- Must: import or load assets, show service reach, source/caveat badges, export evidence memo.
- Should: utilization fields, ACS overlays, gap polygons.
- Could: program-hours weighting, partner-ready share links.
- Won't now: grant-management workflow.

### Real Estate: Site Screening

As a developer or broker, I want to compare a parcel or listing against labor access, customer access, groceries, coffee, schools, hospitals, and friction flags, so I can explain why a site works or fails beyond drive-time slogans.

MoSCoW:
- Must: candidate site marker, nearby amenity categories, walk/drive reach, exportable site summary.
- Should: side-by-side site comparison, parcel/listing import, custom weights.
- Could: rent/price overlays, competitor POI layers.
- Won't now: MLS/IDX production integration.

### Corporate Relocation: Employee Household Fit

As a relocation manager or HR partner, I want to help a candidate understand where they can live with practical commutes and daily-life access, so relocation friction does not derail hiring.

MoSCoW:
- Must: work anchors, household constraints, daily-life categories, printable/shareable shortlist.
- Should: dual-career commute overlap, school/private-school anchors, hospital on-call threshold.
- Could: conversational intake, employer-branded report.
- Won't now: benefits administration or HRIS integration.

### Legislative / Grant Review: Existing Capacity Before New Spend

As legislative staff, I want to test whether a proposed facility fills a true access gap or duplicates reachable existing assets, so public money is tied to evidence rather than ribbon-cutting logic.

MoSCoW:
- Must: proposed site, existing assets, service areas, population/need context, caveated memo export.
- Should: duplication risk score, underserved-area summary, source appendix.
- Could: scenario comparison across proposed sites.
- Won't now: legal compliance determination.

### Consumer Relocation: Town Shortlist

As a household considering a move, I want to pan around a region and quickly answer "Can we live here day to day?" before spending time on listings.

MoSCoW:
- Must: daily-life categories, custom search, reset/share, source badges.
- Should: commute anchors, saved shortlist, school/hospital categories.
- Could: AI intake that turns a paragraph into constraints.
- Won't now: financial advice or school ranking claims.

## Regression Coverage Added

The local Playwright suite now covers:

- iPhone SE width, narrow Android width, standard iPhone width, and iPhone Pro Max width.
- Mobile `/v2` initial entrypoint and category drawer horizontal overflow.
- Results -> list -> detail -> reset.
- Refresh recovery after an active result state.
- Portrait-to-landscape screen tilt.
- Browser back/forward route recovery.

Live Playwright coverage confirms:

- Deployed `/v2` is routable.
- Service-points endpoint returns normalized library data.
- Jersey City routing is covered by the hosted backend.
- Mobile laundry loads POIs and generates Valhalla rings.
- Local app can still talk through the live backend proxy.
