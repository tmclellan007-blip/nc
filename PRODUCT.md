# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: owners, directors and managers of veterinary establishments (Québec first) evaluating whether to request access for their team. Secondary, inside the application: front-desk/telephone staff (Réception), animal health technicians (Équipe technique — TSA), veterinarians, and administrators who manage members, roles and access codes.

## Product Purpose

La Qualia organises, optimises and transmits a veterinary establishment's internal knowledge so onboarding, training and daily support of staff get easier. It delivers AI assistants by role, automations, and interactive tailored training (unlimited call role-plays with quizzes, full simulations with a ringing phone, a learner journey). Success on the public site: a clinic director requests free access or describes their need through the form.

## Positioning

Built by someone from the field: Amélie Brunelle combines 10+ years as an animal health technician and HR manager in a veterinary hospital with technopedagogy and AI transformation. Tools adapt to the team, not the reverse ("La simplicité"), and assistants can answer only from the establishment's own documents.

## Operating Context

Static site on GitHub Pages (FR at `/`, EN at `/en/`), Formspree contact form, consent-gated Google Analytics. The application lives in `/agent/` (connexion, accès, compte, invitation, admin, main app) backed by a Cloudflare Worker (`cloudflare-worker/`) with D1 accounts, Google/Apple/email sign-in, Turnstile, nutrition lookup, favourites and history. Used at a front desk, often on a phone or tablet, sometimes mid-call.

## Capabilities and Constraints

- No text may be modified, rephrased or removed during visual work.
- Business logic, database, worker, endpoints, form fields, analytics consent logic and all DOM hooks used by scripts and tests must be preserved.
- End-to-end UI tests in `cloudflare-worker/tests/ui*.mjs` and unit tests `*.test.mjs` must keep passing.
- `nc` is the test copy; `laqualia` is production and must not be touched.

## Brand Commitments

- Logo "Q facetté" (symbol + wordmark) kept as is.
- The five logo colours (orange `#ff5a00`, coral `#ff735c`, purple `#401098`, blue `#005dff`, lime `#c7ff00`) remain the brand palette.
- Must not feel: cold "tech startup", sterile medical, overloaded/multicolour, or bland.

## Evidence on Hand

Hero photo, Amélie Brunelle portrait, avatars, real app screenshots in `assets/app/`, qualitative growth chart (explicitly not measured data). No testimonials, client logos, certifications or metrics exist; none may be invented.

## Product Principles

1. Simplicity first: technology adapts to the team.
2. Field credibility over hype.
3. Honest illustration: demos and curves are labelled as examples.
4. Privacy by default (Loi 25, consent before analytics).

## Accessibility & Inclusion

Respect reduced motion, keyboard navigation, visible focus, WCAG AA contrast; usable one-handed on a phone at a front desk.
