# Nametag: ideas and improvements from a personal fork

This is **not a pull request**. It is a tour of what I built in my fork of Nametag, so that you can see it
before deciding whether any of it is interesting for the project. Everything below runs against made-up test
data. Nothing here is meant to be merged as one block (see "How I would contribute it" at the end).

The visual style is unchanged: same tokens, same components, dark mode as the default, light mode equally
supported. Every screen works on a phone.

## Dashboard

The greeting, key figures and the network now fit on one screen, and the graph opens centered on you instead of
somewhere off screen. There is a full screen mode, a search field inside the graph, a legend, and people without any
connection move into a collapsible list instead of drifting far away from the rest.

![Dashboard, light](img/01-dashboard-light.jpg)
![Dashboard, dark](img/02-dashboard-dark.jpg)

Branches: `fix/dashboard-graph-fit`, `feat/dashboard-overview`, `feat/graph-wheel-and-compact`

## Editing in place

The people list edits the relationship, the last contact (with a "Today" button) and the location right in the
table. The group page shows its members as the same table plus a "Connections" column, with a list and a network
view. "Select all" now respects the active filters (it used to affect every contact when a filter was active).

![People table](img/03-people-table-quick-edit.jpg)
![Group members with connections](img/06-group-members-with-connections.jpg)
![Group network view](img/07-group-network-view.jpg)

Branch: `feat/people-quick-edit`

## Person page

Quick actions without opening the edit form: relationship, "Today", groups and a note. The relationship network
is only as tall as it needs to be, and the mouse wheel scrolls the page unless Ctrl or Cmd is held (on touch
screens a vertical swipe scrolls the page).

![Person page](img/04-person-quick-actions.jpg)
![Compact network on the person page](img/05-person-compact-network.jpg)
![Add person](img/15-add-person.jpg)

Branches: `feat/person-profile-quick-actions`, `feat/graph-wheel-and-compact`

## Groups and relationship types

A page per relationship type lists the people you have that relationship with and lets you add many at once. The
groups overview has quick creation, search, sorting and member previews.

![Groups overview](img/08-groups-overview.jpg)
![Relationship type page](img/09-relationship-type-members.jpg)

Branches: `feat/relationship-type-members`, `feat/groups-and-types-overview`

## Search, shortcuts, journal

Search ranks by name first, shows relationship and groups, and offers quick actions per result (Shift+Enter or
Tab). Keyboard shortcuts with a help overlay (`?`). The journal opens with the cursor in the text field and saves
with Ctrl/Cmd+Enter. Drafts are kept per account and cleared on sign out.

![Search with quick actions](img/10-search-quick-actions.jpg)
![Keyboard shortcuts](img/11-keyboard-shortcuts.jpg)
![Journal quick entry](img/12-journal-quick-entry.jpg)

Branches: `feat/search-and-navigation`, `feat/journal-quick-entry`

## Settings and CardDAV

A settings start page with search, instant saving with feedback, and live previews for theme and name format.
The CardDAV connection form has provider presets and a clear test result; import is a step by step wizard with
search and filters, and conflicts are shown field by field.

![Settings](img/13-settings-overview.jpg)
![Appearance](img/14-settings-appearance.jpg)
![CardDAV connection](img/16-carddav-server-form.jpg)

Branches: `feat/settings-clarity`, `feat/carddav-flow-ux`

## On a phone

![Dashboard on a phone](img/17-mobile-dashboard.jpg)
![Person page on a phone](img/18-mobile-person.jpg)
![People table on a phone](img/19-mobile-people-table.jpg)

## Not shown here

Map: select people on the map and assign groups or relationships, filters, and a list of people without a
location. Duplicates and trash: duplicates sorted by confidence with a one step merge, a trash with search and
bulk restore. See the branches `feat/map-quick-assign` and `feat/duplicates-merge-trash-ux`.

## Numbers and honesty

- Everything together is about 33,000 added lines in 326 files, but about 20% of that is translations (all 11
  languages, key trees identical), about 24% tests and the rest is code and docs. More than 4,500 unit and
  component tests pass.
- I tested it in a browser against made-up data. The CardDAV flows were **not** tested against real servers,
  and the provider presets are unverified.
- Most of this was developed with the help of Claude Code, an AI coding assistant, and I am testing it myself
  before proposing anything.

## How I would contribute it

Not as one block. If you are interested, I would send small pull requests, one after the other, each with tests,
translations and docs, rebased on `master`:

1. Small fixes: centering the dashboard graph, "select all" with filters, wheel scrolling on the person page.
2. A page per relationship type.
3. In-place editing in the people list and the group page.
4. Anything larger only if you want it, split into pieces you can review in one sitting.

Tell me which of these you would like to see, and which you would rather not have. The two pull requests that
are already open (CardDAV fetch by URL, calendar tab) come first.

The full code is in this fork: branch `fork-main` has everything merged, and each topic has its own branch.
