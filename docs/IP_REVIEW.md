# Preliminary intellectual-property review

**Review date: 2026-09-28. Scope: current WireSnaps browser software, source,
assets, labels and catalogue data; US, UK and EU focus.** This is a technical
screening with public-source research, not a legal opinion or freedom-to-operate
clearance. A qualified IP lawyer must assess applicable claims, territories and
intended commercial use before this can be treated as clearance.

## Findings and changes

| Area | Finding | Applied change / remaining issue |
| --- | --- | --- |
| Default branding | The code editor called the virtual AVR board Snapino even with original naming selected. | Changed it to AVR controller. Manufacturer names remain referential, opt-in comparisons. |
| Reference transparency | Brand mapping notes were present in metadata but not shown in the parts guide; the Znatok reference is a third-party manual copy. | Display the notes, mark Znatok numbering provisional, and add an independence notice when reference names are selected. |
| Catalogue text | The 329-candidate inventory contained 4,852 copied `label`/`context` fields, including surrounding catalogue prose and prices. | Removed those fields; use original component names or neutral identifiers. Keep every candidate, status, component link and source location/hash. The inventory extractor now produces this minimal form. |
| Visual content | Current parts and UI are procedural artwork; the source export excludes cached manuals and their extracted text. | Retain original visuals and screenshots. Do not add manufacturer logos, copied diagrams or product photographs without appropriate rights. Trade-dress/design clearance is still open. |
| Open-source licensing | GPL-3.0-or-later, inherited file notices, dependency notices and a source archive exist. | Keep all of them, include the new build dependency's notices, and add automatic checks against redistributing reference PDFs/text caches. |
| Missing licence texts | Installed Blockly and Rapier packages omit their Apache licence files; the collector also missed hyphenated names such as `LICENSE-MIT.txt`. | Include versioned upstream licence texts with recorded hashes, fix filename detection, and require text for all direct runtime dependencies. Some build-only packages supply only package declarations; that limitation remains explicit in the notice manifest. |
| Patents | Relevant hardware and simulation patent publications were found. | No definite claim overlap requiring a specific engineering redesign was established by this limited review. This is **not** a finding of non-infringement. See the claim comparison below. |

## Patent screen: documents and technical comparison

Search terms included `Elenco Electronics patents`, `Elenco patent circuit`,
`Elenco patent simulation`, `snap circuit simulator patent virtual`, and
`virtual electronic educational circuit simulator`. Assignee searches included
Elenco Electronics, Inc. and LLC. The following are leads, not an exhaustive
family, continuation, design-patent or landscape search.

Status labels below are those shown by the named public source when inspected;
they have not been independently confirmed in every official national register.
Expiration, maintenance, ownership and family status must not be inferred solely
from a filing date or a search aggregator's label.

| Publication | Reviewed subject matter | Comparison with the current implementation |
| --- | --- | --- |
| [US7144255B2](https://patents.google.com/patent/US7144255B2/en) | Quick-connect physical circuit modules, snap-fitting connectors and safety arrangements. The source labels it expired. | WireSnaps supplies a software model and generic protection behavior, not manufactured connectors or the patented safety product. Do not describe the simulation as CircuitSafe technology. Physical module manufacture would need a separate review. |
| [US7273377B2](https://patents.google.com/patent/US7273377B2/en) | A physical breadboard/stackable-connector module; source labels it expired. | No physical converter is made or supplied. Similar-looking interaction alone is not a claim analysis; hardware additions require reassessment. |
| [US10252176B2](https://patents.justia.com/patent/10252176) and [EP3681611B1](https://patents.google.com/patent/EP3681611B1/en) | Building-block adapters joining a physical construction toy and snap-connected electronic toy. EP claim 1 specifies mating and snap-fitting members; the EP source labels the grant active. | The current software has no physical brick adapter. The European granted text is also available from the [EPO publication server](https://data.epo.org/publication-server/rest/v1.2/publication-dates/20230510/patents/EP3681611NWB1/document.pdf). National validations, including any UK position, remain unverified. |
| [US12029996B2](https://patents.google.com/patent/US12029996B2/en) | An illuminated physical toy brick with walls, conductive nodes and an internal light device; source labels it active. | No such physical brick is supplied, and the current exposed catalogue does not implement that full brick construction. Future catalogue expansion needs review. |
| [US11931659B1](https://patents.google.com/patent/US11931659B1/en) | Electrical board-game structure including game cards and competing paths; source labels it active. | WireSnaps has no card deck, competing-player circuit race or the claimed board arrangement. A project-selection card in the UI is not used as a turn-taking game piece. |
| [US12048883B1](https://patents.google.com/patent/US12048883B1/en) | A turn-taking, card-driven electrical board-game method; source labels it active. | The current lessons do not implement the reviewed card-drawing and competitive turn sequence. Do not add such a game without a new claim review. |
| [US20250018277A1](https://patents.google.com/patent/US20250018277A1/en) | A related electrical-game application with game cards and board paths for different skill levels. | Treat as a pending/family follow-up lead, not as a confirmed enforceable grant. Prosecution and any issued claims remain to be checked. |
| [US20140178845A1](https://patents.google.com/patent/US20140178845A1/en) | Computer-based electrical teaching simulator: simulated components, supply, test equipment and user configuration. The source labels it abandoned. | This is closer to the software's function than the physical-toy documents. Confirm abandonment, family members and any surviving claims; do not assume that a graphical circuit simulator is automatically outside patent scope. |

These comparisons are engineering observations, **not claim-construction
conclusions**. Software distribution does not automatically avoid all patent
claims; method claims, equivalents, indirect infringement and other owners'
patents require assessment. No exhaustive search of circuit-solving, emulation,
visual programming, routing or simulation algorithms was performed.

## Trademark screen

Exact web searches for `WireSnaps`, `Wire Snaps software trademark` and
`WireSnaps trademark patent` did not identify a clear competing electronics
software brand in the results inspected. An unrelated printer manual used
“wiresnaps” descriptively. **This is not availability clearance**: phonetic,
visual and conceptual similarity and common-law use still matter.

The following public-interface searches were completed in a Docker browser on
the review date. These record the returned results, not the availability of a
name in a market. Minimal query details are retained in
[the search log](../provenance/ip-searches.json).

| Source and query | Observed result | Limit |
| --- | --- | --- |
| [USPTO trademark search](https://tmsearch.uspto.gov/), Wordmark: `WireSnaps` | No results found. | Does not cover every similar mark or common-law use. |
| [USPTO: WIRESNAP, serial 75910403](https://tmsearch.uspto.gov/search/search-results/75910403), Wordmark: `WireSnap` | One result: WIRESNAP, filed 28 January 2000, shown as abandoned with status date 17 July 2001. No registration number. The listed services concern wireless digital messaging and internet broadcasting, class 038; the listed owner is WireSnap Partners. | The singular name is a similarity lead. An abandoned application does not prove that use stopped or that no unregistered rights exist. |
| [USPTO trademark search](https://tmsearch.uspto.gov/), Wordmark: `"Wire Snaps"` | The interface returned 2,567 broad results, including marks containing individual tokens. | This did not behave as a strict phrase search; the result set was not reviewed for clearance. |
| [EUIPO-coordinated TMview](https://www.tmdn.org/tmview/#/tmview/results?page=1&pageSize=30&criteria=C&basicSearch=WireSnaps), trade mark name Contains: `WireSnaps` | No rows found under the interface's default office/territory settings. | TMview states that it is not an official register and its data has no legal effect. No fuzzy or full territory-by-territory search was completed. |
| [UK IPO keyword search](https://trademarks.ipo.gov.uk/ipo-tmtext/start) | A security check prevented the registry query; it was not bypassed. | UK registry screening remains incomplete. |

The [USPTO search guidance](https://www.uspto.gov/trademarks/search/federal-trademark-searching)
calls for searching similar marks and related goods or services, beyond identical
words. No completed US/UK/EU clearance is claimed. Follow-up should cover related
software, education and toys (including relevant classes 9, 28, 41 and 42), name
variants, actual market use of WIRESNAP and common-law sources. Class numbers
alone do not settle similarity. [EUIPO availability guidance](https://www.euipo.europa.eu/en/trade-marks/before-applying/availability)
and the [UK search entry](https://www.gov.uk/search-for-trademark) provide starting
points for completing the remaining searches.

Elenco's [own website](https://elenco.com/) identifies Snap Circuits as its brand
and markets CircuitSafe as patented technology. A [Canadian official Snap Circuits record](https://ised-isde.canada.ca/cipo/trademark-search/pdf/1448164?lang=eng)
identifies Elenco Electronics, LLC as owner; this confirms a referential brand
lead, not US/UK/EU registration status. The US lead is serial 85113281 / registration
3940898; [TSDR](https://tsdr.uspto.gov/#caseNumber=85113281&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch)
did not return case-specific data through text retrieval, so its current status
was not independently verified here.

Arduino's [trademark policy](https://www.arduino.cc/en/trademark) separates code
licensing from permission to use the brand and requires an acknowledgement for
referential use. WireSnaps uses original controller labels, no Arduino logo and
no claim of certification. Internal legacy IDs such as `snapino` remain for
project compatibility; they do not rename the product.

Znatok / Знаток ownership, registration territories and the authenticity of the
linked secondary manual copy were not verified. References are marked
provisional. No claim of official affiliation or verified physical compatibility
is made. The product name WireSnaps itself still needs a similarity search;
an independence disclaimer cannot cure a confusing name or visual appearance.

## Copyright, trade dress and catalogue/database rights

The application does not distribute the original manuals, their photos or
project drawings. Its current model geometry, explanations and demo circuits
are original code/content. This source inspection cannot establish independent
creation of every historical contribution or exclude all design/trade-dress
similarity. Rounded snap bodies and functional colours are retained; no finding
in this review justifies asserting that this is a cleared replica of any kit.

Copied catalogue excerpts were unnecessary and have been removed from the
current inventory and rebuilt export. The replacement data retains factual
part identifiers and source URLs/pages/hashes. Automated checks also inspect
the corresponding-source archive for reference caches, PDFs and quoted evidence
fields. Prior local build commits are not rewritten by this change and can
contain older artifacts; this is not a history-wide data removal claim.

The [UK government's database-rights guidance](https://www.gov.uk/guidance/sui-generis-database-rights)
distinguishes copyright from the separate protection potentially applying to
database investment. A minimal factual schema does **not** resolve whether
systematically extracting a substantial part of a catalogue is permitted.
Permission, applicable exceptions, terms and UK/EU database eligibility have not
been resolved. Keep this question open before substantially expanding or
commercially republishing the catalogue. The full inventory is preserved to
avoid silently weakening the requested completion gate.

GPLv3+ applies to the derived software and original contributions, not to third
parties' trademarks, patents or reference materials. Upstream notices and
file-hash provenance remain intact. Dependency licence collection includes
versioned notice files; legal compatibility is not established merely by an
automated scanner finding a licence identifier.

## Follow-up required for legal clearance

1. Confirm intended countries, commercial distribution and whether physical
   parts, print-ready models or manufacturer project reproductions are planned.
2. Complete official-register and common-law trademark similarity searches;
   assess WireSnaps branding and the visual presentation.
3. Have patent counsel review the relevant families, actual current claims,
   prosecution and national status against the product's specific features.
4. Resolve catalogue/database reuse permissions and any new asset licences.
5. Reassess when new proprietary modules, brick adapters, game mechanics,
   firmware backends or hardware deliverables are introduced.

**Result:** practical reductions in labelling and copied-content risk were
implemented. Patent, trademark, design and database clearance remains open.
