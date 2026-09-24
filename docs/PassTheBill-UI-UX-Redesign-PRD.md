# PassTheBill — UI/UX Simplification Redesign PRD

## Document purpose

This is the implementation handoff for the complete PassTheBill UI/UX
redesign. It is intended for Codex, Claude Code, Cursor, human
developers, QA, and future maintainers.

The redesign is a frontend-first simplification of the existing Android
application. Preserve the current backend, database, RPCs,
authentication, realtime, notifications, billing calculations,
settlements, and food-image functionality unless a change is genuinely
required by the new UI.

## Product goal

PassTheBill currently exposes too much of its internal
accounting/workflow complexity. The redesigned application should feel
like a simple group-lunch app rather than an accounting system.

Core rule:

> One screen = one question. One primary action = one obvious answer.

A new user should understand what to do without learning terms such as
billing cycle, claim, member confirmation, delivery exclusion, or
settlement.

## Design reference

The primary visual reference is the modern PassTheBill UI mockup
generated during planning.

Target characteristics:

- Light theme by default
- Cream/off-white background
- Green primary actions
- Soft purple spending/history accents
- Rounded cards
- Subtle shadows
- Generous whitespace
- Clear typography hierarchy
- Compact food thumbnails
- Friendly, simple iconography
- Four-tab bottom navigation
- Large obvious CTAs
- Minimal technical terminology

The mockup is a visual reference, not pixel-perfect production code.

## Target color system

Use centralized theme tokens.

Primary green: `#0A9665`

Secondary green: `#2CAC7F`

Main background: `#FCFCFD`

Soft gray/surface: `#F1F5F9`

Mint surface: `#E5F7F0`

Primary text: `#151625`

Secondary text: `#617087`

Muted text: `#95A4BA`

Soft purple: `#EDE9FF`

Purple accent: `#7C68E8`

Error: `#D82323`

Warning: `#F1AD4A`

Do not scatter arbitrary colors through screen files. Centralize the
palette in the existing theme system.

## Theme

Light must become the default theme.

Dark mode must remain supported.

Settings must retain:

- Light
- Dark
- System

A fresh installation should start in Light.

## Typography

Use a clear hierarchy:

- Screen title: approximately 24–26px bold
- Section title: approximately 16–18px semibold
- Body: approximately 14–16px
- Supporting text: approximately 12–14px
- Important totals: large and bold

Follow the existing font setup unless there is a compelling reason to
change it.

## Spacing

Standardize around:

`4, 8, 12, 16, 20, 24, 32`

Typical screen horizontal padding: 16–20px.

Cards should have comfortable internal padding.

## Navigation

Final main navigation:

1.  Orders
2.  Spending
3.  Team
4.  Settings

Do not use a dedicated New tab. Creating an order starts from Orders.

Active navigation should use primary green. Inactive navigation should
use muted gray/blue-gray.

Use one consistent icon family.

## Orders / Home

File:

`src/app/(tabs)/index.tsx`

This is the primary screen.

Header example:

Good morning, Tahir 👋

Test Team

Current lunch card:

Lunch today

KFC 12:30 PM \>

Active order:

KFC — Open

5 items · Rs 1,950

Your order is waiting!

Choose your items →

The primary action must be obvious.

If a future order exists, show:

Next lunch

Tue, 24 Sep · 12:30 PM \>

If no orders exist:

🍔

No orders yet

Get the team started with a lunch order.

- Start an order

Do not show irrelevant empty statistics.

## New Order

Relevant files:

`src/app/(tabs)/new.tsx` `src/app/order-form.tsx`

Use a simple guided flow.

Restaurant step:

New Lunch

What are we ordering?

Search restaurant…

Then simple restaurant rows such as:

KFC Fast food · Burgers · Chicken \>

McDonald’s Burgers · Fries · Drinks \>

Pizza Hut Pizza · Pasta · More \>

Subway Sandwiches · Salads · More \>

After restaurant selection:

KFC

What are we having?

- Add item

Items should be compact rows/cards:

🍔 Zinger Burger Rs 450

🍟 Fries Rs 200

🥤 Coke Rs 120

Keep the existing food-image functionality. Use compact thumbnails
around 64x64. Never use huge full-width food photos.

## Order Detail

File:

`src/app/order/[id].tsx`

The screen should answer:

“What do I want from this order?”

Example:

KFC

Today · 12:30 PM

What are you having?

Each item should have an easy quantity control:

Zinger Burger Rs 450 − 1 +

Bottom:

Your total Rs 450

Done

Do not expose implementation terminology such as claims.

## Order confirmation

After completion:

✓

Order confirmed!

Your lunch order has been saved.

KFC Today · 12:30 PM 5 items · Rs 1,950

Back to orders

Keep the success state clear and calm.

## Spending

Existing file:

`src/app/(tabs)/totals.tsx`

Recommended user-facing name:

My Lunches

Keep the underlying totals/billing functionality.

Summary:

September

Rs 8,450

Your lunch spending

12 lunches · 4 weeks

Monthly rows:

This month

KFC Rs 1,950 McDonald’s Rs 1,250 Pizza Hut Rs 900 Subway Rs 720

Previous months:

August Rs 7,320 \> July Rs 6,850 \>

Use soft purple for the spending summary.

## Historical spending

Do not expose internal terminology such as Billing Cycle \#123 or
Confirmation Row.

Use:

August

Your total Rs 7,320

12 lunches 4 team lunches

KFC Rs 1,950 Pizza Hut Rs 900

The existing billing-cycle data can power this detail.

## Team

File:

`src/app/(tabs)/team.tsx`

Header:

Your Team

Summary:

👥 8 people Test Team

Members:

Tahir You \> Ali \> Sarah \> Ahmed \> Usman \> Hassan \> Ayesha \>
Fatima \>

Team code:

Team code

ABC123

Share this code with someone joining the team.

Copy

Secondary action:

- Invite someone

Keep advanced management actions behind secondary interactions.

## Settings

File:

`src/app/(tabs)/settings.tsx`

Target structure:

Settings

Your account

Tahir Test profile Edit profile

Preferences

Appearance System \> Notifications Enabled \>

Team

Test Team \>

Help & feedback

Send feedback \>

Sign out

Keep the first-level settings concise.

## Authentication and onboarding

Files:

`src/app/sign-in.tsx` `src/app/onboarding.tsx` `src/app/join.tsx`
`src/app/auth-callback.tsx`

Preserve authentication behavior.

Sign-in should be simple:

PassTheBill

Lunch made simple.

Continue with Google

or

Sign in another way

Onboarding should be no more than three conceptual screens:

1.  Lunch without the hassle.
2.  Order together.
3.  Everyone pays their share.

Final CTA:

Get started

Join-team flow:

Join a team

Enter your team code

\[ ABC123 \]

Join team

## Backend preservation

Existing tables include:

- teams
- members
- orders
- order_items
- claims
- delivery_exclusions
- extra_charges
- settlements
- billing_cycles
- billing_cycle_orders
- billing_cycle_confirmations
- push_tokens

Existing important RPC/functions include:

- create_team()
- join_team()
- close_order()
- check_claim_units()
- check_item_qty()
- respond_to_charge()
- trigger_billing_cycle()
- confirm_billing_cycle()
- close_billing_cycle()
- send_push()
- notify_new_order()
- notify_extra_charge()

Do not rewrite or rename these for cosmetic reasons.

Do not change RLS, billing calculations, or database structure unless a
genuine functional requirement is discovered.

## Billing-cycle UX

The backend workflow remains:

Orders → Close orders → Start billing cycle → Include eligible closed
orders → Calculate member shares → Confirm totals → Close cycle → View
history

The user-facing language should instead be:

Review lunches

Your total

Everything looks right?

Confirm

Do not expose billing-cycle internals unless genuinely useful.

Participating-member behavior must remain intact. Confirmation rows
should only be created for participating members with positive totals.

## Orders filtering

The Orders screen should show:

- Orders in the current open billing cycle
- New orders not yet included in any tally

It should hide orders belonging only to previous closed cycles.

After a cycle closes, old-cycle orders disappear from the active Orders
view and current/new orders remain.

Do not introduce database changes solely for this presentation behavior.

## Shared UI

Inspect and reuse:

`src/components/ui.tsx`

Update shared primitives centrally when possible instead of duplicating
styles.

Potential primitives:

- Screen
- Card
- Button
- IconButton
- SectionHeader
- StatusBadge
- ListRow
- EmptyState
- BottomSheet

Do not create abstractions without a real reuse case.

## Bottom sheets

Use bottom sheets for secondary interactions such as:

- Edit profile
- Order options
- Extra charges
- Historical details
- Secondary settings
- Appropriate confirmations

Keep primary screens uncluttered.

## Status language

Green:

- Open
- Ready
- Confirmed

Orange:

- Waiting
- Needs attention

Gray:

- Closed
- Past

Red:

- Error
- Remove
- Cancel

Do not expose arbitrary technical statuses.

## Buttons

Primary:

`#0A9665` with white text.

Examples:

- Create order
- Done
- Confirm
- Join team
- Start an order

Secondary buttons should use light/white surfaces with subtle borders.

Destructive actions use soft red with red text.

## Cards

Keep only a few surface types:

1.  Standard white/light card with subtle shadow
2.  Mint positive card using `#E5F7F0`
3.  Soft-purple spending/history card using `#EDE9FF`
4.  Soft warning card

## Food images

Preserve the existing architecture:

React Native order form → item-name inactivity → Supabase Edge Function
→ OpenRouter normalization → Pexels search → image URL → local
order-form state → `order_items.image_url`

Keep food thumbnails compact, approximately 64x64.

Existing normalization quality must not regress. Important examples
include:

- Chicken cutlus → chicken cutlet food
- Chicken burger → chicken burger
- Chicken biryani → chicken biryani
- Daal chawal → daal chawal
- 2 Naan → naan bread food
- 500ml Coke → Coca Cola drink

Do not collapse multi-word food identity into an unrelated single word.

## Android requirements

The app is Android-first.

Preserve correct:

- Status-bar behavior
- Safe areas
- Android keyboard behavior
- Back button
- Bottom navigation
- Touch targets
- Scroll behavior
- Bottom sheets
- Modal behavior

A previous issue caused the tab bar to move above the keyboard because
of a global KeyboardAvoidingView. Do not reintroduce a global
KeyboardAvoidingView around the application.

Handle keyboard avoidance locally where needed.

Verify:

- New Order
- Item entry
- Search
- Profile editing
- Feedback
- Join team

## Realtime

Do not break existing Supabase realtime behavior.

Verify that changes from other members continue to appear appropriately.

## Notifications

Do not break:

- Push registration
- Push tokens
- New order notifications
- Extra charge notifications
- Notification permissions
- Custom notification sound

Native notification changes require a new native build.

## EAS Update

This redesign is primarily JavaScript/UI work and should remain
compatible with EAS Update.

Do not introduce native dependencies unnecessarily.

Native Android changes still require a new build.

## Loading states

Every data-dependent screen needs an intentional loading state.

Use simple skeletons or restrained loading indicators.

Do not show blank screens.

## Empty states

Orders:

No orders yet + Start an order

Spending:

No lunches yet Your lunch spending will appear here.

Team:

No team members Invite someone to get started.

## Error states

Never show raw Supabase/database errors to ordinary users.

Prefer:

Something went wrong. Please try again.

with a Try again action where appropriate.

Technical details may remain in logs.

## Animation

Use animation sparingly:

- Screen transitions
- Bottom sheets
- Button feedback
- Success checkmark
- Subtle card appearance

Avoid constant movement and distracting backgrounds.

The application should feel fast.

## Accessibility and usability

Ensure:

- Comfortable touch targets
- Readable text
- Adequate contrast
- Icons are not the only source of meaning
- Important actions have text labels
- Long names do not break layouts
- Currency values remain readable
- Predictable scrolling
- Keyboard does not hide primary actions

## Responsive behavior

Do not hard-code the mockup’s dimensions.

Test at least:

- Small Android phone
- Standard Android phone
- Large Android phone

## Implementation sequence

### Phase 0 — Repository audit

Before editing:

1.  Inspect the current repository.
2.  Inspect package.json.
3.  Inspect app.json.
4.  Inspect theme.
5.  Inspect shared UI components.
6.  Inspect navigation.
7.  Inspect every affected screen.
8.  Inspect Supabase interactions.
9.  Identify differences between current code and this PRD.
10. Do not overwrite newer functionality with older versions.

### Phase 1 — Design tokens

Update the centralized theme with:

- New colors
- Light default
- Typography
- Spacing
- Radii
- Shadows
- Status colors

### Phase 2 — Shared UI

Update/create shared UI primitives as needed.

### Phase 3 — Navigation

Update:

`src/app/(tabs)/_layout.tsx`

Final tabs:

Orders / Spending / Team / Settings

### Phase 4 — Orders

Update:

`src/app/(tabs)/index.tsx`

Implement the simplified home.

### Phase 5 — New Order

Update:

`src/app/(tabs)/new.tsx` `src/app/order-form.tsx`

### Phase 6 — Order Detail

Update:

`src/app/order/[id].tsx`

### Phase 7 — Spending

Update:

`src/app/(tabs)/totals.tsx`

User-facing name: My Lunches.

### Phase 8 — Team

Update:

`src/app/(tabs)/team.tsx`

### Phase 9 — Settings

Update:

`src/app/(tabs)/settings.tsx`

### Phase 10 — Auth/onboarding

Update where needed:

`sign-in.tsx` `onboarding.tsx` `join.tsx`

### Phase 11 — Final polish

Verify:

- Bottom sheets
- Keyboard
- Back button
- Loading states
- Empty states
- Errors
- Success states
- Realtime
- Notifications
- Food images
- Dark mode
- Light default
- Long text
- Small screens

## Testing

Test the complete new-user flow:

Install → Sign in → Create/join team → Orders → Create order → Add items
→ Finish

Test existing-member flow:

Open app → See current order → Choose items → Finish

Test billing:

Close order → Review billing cycle → Confirm participating total → Close
cycle → Verify history

Test team:

Create team → Copy/share code → Join team → Verify member

Test notifications:

- New order
- Extra charge
- Permissions
- Sound
- Realtime

## Regression checklist

Verify that the redesign does not break:

- Authentication
- Google OAuth
- Team creation
- Team joining
- Order creation
- Order closing
- Claims
- Quantity handling
- Delivery calculations
- Extra charges
- Billing cycles
- Confirmations
- Settlements
- Push notifications
- Realtime
- Profile editing
- Feedback
- Theme switching
- Food images

## Definition of done

Visual:

- Light is the default.
- Target green/cream/purple palette is consistently used.
- All screens feel like one product.
- Cards/buttons/icons are consistent.
- No major screen feels overloaded.

UX:

- Four-tab navigation exists.
- Orders is the primary home.
- New order is simple.
- Order detail is simple.
- Spending is understandable without accounting terminology.
- Team is understandable without technical terminology.
- Settings is concise.
- Empty/error states are intentional.

Functional:

- Existing backend behavior works.
- Billing logic works.
- Notifications work.
- Realtime works.
- Food images work.
- Profile works.
- Feedback remains accessible.

Android:

- Keyboard does not move the tab bar incorrectly.
- Back button works.
- Safe areas work.
- Touch targets are comfortable.
- Small screens work.

## Implementation rules

1.  Inspect current code before changing it.
2.  Do not assume older files are still current.
3.  Do not rewrite backend logic for cosmetic reasons.
4.  Do not remove functionality simply because it is hidden.
5.  Use shared theme tokens.
6.  Keep Light as the default and retain Dark/System.
7.  Do not reintroduce the global KeyboardAvoidingView problem.
8.  Do not introduce native dependencies unless absolutely necessary.
9.  Do not make native changes merely for styling.
10. This is an application-wide redesign, not a single-screen prototype.

## Deliverables

The implementer must deliver:

1.  Updated source code.
2.  Centralized design system.
3.  Updated navigation.
4.  Redesigned Orders.
5.  Redesigned New Order.
6.  Redesigned Order Detail.
7.  Redesigned Spending/My Lunches.
8.  Redesigned Team.
9.  Redesigned Settings.
10. Updated auth/onboarding where needed.
11. Updated shared components.
12. No broken backend functionality.
13. No notification/realtime regressions.
14. Android testing/verification.

## Final mental model

The desired experience is:

OPEN APP → “What is happening with lunch?” → CHOOSE WHAT I WANT → DONE →
“How much have I spent?” → “My Lunches”

Not:

OPEN APP → Understand billing cycle → Understand order state →
Understand claims → Understand member totals → Find action

The redesign exists to move the product from the second mental model to
the first.

## Final screen map

AUTH - Sign In - Onboarding - Join Team

MAIN APP - Orders - Empty - Current Orders - New Order - Restaurant -
Items - Delivery/Review - Order Detail - Order Confirmed - Spending -
Current Month - Historical Month Detail - Team - Members - Team Code -
Invite - Settings - Profile - Appearance - Notifications - Team -
Feedback - Sign Out

## Primary success metric

A new user should be able to open PassTheBill and understand what to do
without reading instructions.

The redesign should not merely make the application prettier.

It should make the application easier to use.

## Implementation status

Planning complete.

Implementation begins only after explicit product-owner approval.

Once approved, the implementer should treat this document as the
authoritative UI/UX handoff while still inspecting the current
repository before making changes.
