---
title: Map
description: See your contacts on a map with geocoded addresses.
sidebar:
  order: 6
---

The Map tab shows where your contacts are, plotted on an interactive world map from the addresses and locations you've already added to their records.

## How it works

When you add an address to a contact, Nametag geocodes it in the background, converting the street address into latitude and longitude using a Nominatim-compatible geocoding service. Once geocoding succeeds, the address appears as a marker on the Map tab. You don't need to do anything beyond entering the address.

The second address line gets special treatment: lookups try the full address first, then retry without the second line. So apartment numbers, building names, or any extra text there can help locate the address but never prevent it from being found.

## The map interface

The map itself is built on MapLibre GL, giving you smooth zooming, panning, and clustering of nearby markers. Contacts with a photo appear as a small circular photo thumbnail, ringed in the color of the first group they belong to; contacts without a photo show as a plain colored dot in that same group color, falling back to the default marker color when they aren't in a colored group. When multiple people share the same address (such as partners or family members living together), the map shows a single count circle at that location instead of stacking individual markers on top of each other. Click a marker to open its card (see below). Clicking a co-located count circle opens a card for everyone at that address.

## Filtering

A filter bar above the map lets you narrow down what's shown:

- **Text search**: matches against contact names
- **Group**: show only people in a specific group
- **Relationship**: show only people with a given relationship to you, or only people without one
- **Last contact**: show people you have not talked to for over 1, 3, or 6 months, or over a year, or people you have never contacted. People with no recorded contact count as not talked to
- **City**, **region/state**, and **country**: narrow down by location. Since combining these three rarely makes sense together, picking one clears the other two, but you can still combine any one of them with the other filters

Above the map, a counter shows how many people are visible with the current filters. On a phone the city, region, and country selects are folded behind **More filters**.

## Editing people on the map

Click or tap a marker to open a small card with the person's name, address, relationship, groups, and when you last talked. From the card you can:

- tap **Contacted today** to set the last contact to today
- change the relationship
- add the person to a group
- open the contact page, get directions, or start a selection with this person

Changes are saved right away, without leaving the map. If several people share an address, the card lets you switch between them.

## Selecting several people

Tap **Select** above the map to select people:

- **Tap markers**: tap a marker to select it, tap again to deselect. A marker that stands for a shared address selects everyone there
- **Draw a frame**: drag a frame around markers with your mouse or finger to select all of them. Pan and zoom are paused while the frame tool is active, switch back to **Tap markers** to move the map
- **Select all shown**: selects everyone matching the current filters
- **People list**: the list drawer has a checkbox for every person

As soon as someone is selected, a bar at the bottom offers **Add to Groups** and **Set Relationship**, the same actions as in the [people list](/features/bulk-actions/). The map always sends the explicit list of selected people.

## People list and people without a place

**People list** opens a drawer (a sheet from the bottom on phones, a side panel on larger screens) with two tabs:

- **On the map**: everyone visible with the current filters. Tap a name to jump to them and open their card
- **No place yet**: contacts without a marker, with the reason (no address, being located, could not be located, locating turned off). Tap **Set place**, type a city and pick a country, and save. Nametag stores it as an address and locates it in the background; the marker appears a few seconds later. The country is preselected with the one most of your contacts live in. For a contact whose address could not be located, the city and country are filled into that address and its other parts stay as they are. The location filters do not apply to this tab

## Remembered view and filters

The map remembers where you left it. When you open the map without a filtered link, it returns to your last position and zoom and re-applies your last filters (group, relationship, last contact, city, region, country). This is stored only in your browser and per account; the search text and the places of individual people are never stored.

## URL-based state and sharing

Every filter you set is encoded in the page URL, so a filtered view of the map is bookmarkable and shareable. Send someone a link with your filters applied and they'll see the same view. A link with filters or a `focus` always wins over the remembered view.

## Deep linking to a person

Add `?focus=<markerId>` to the map URL (where the marker id looks like `addr_<addressId>` or `loc_<locationId>`) to center the map on that marker and open its card automatically. This is how the "Show on map" links on a person's detail page jump straight to their spot on the map.

## Auto-zoom

If you arrive at the Map tab with filters already present in the URL, the map automatically zooms and pans to fit all the matching markers, so a shared filtered link shows the right view immediately instead of the default world zoom.

## Opting out

Not everyone wants their contacts' addresses sent to a third-party geocoding service. You can turn this off entirely in **Settings > Map**. When disabled, none of your addresses are geocoded, and any pending or previously geocoded coordinates stop updating.

## For self-hosted instances

Administrators can disable geocoding for every user on an instance by setting `DISABLE_GEOCODING=true`. Geocoding itself runs via a background cron job every 5 minutes, processing up to 50 addresses per batch at a rate of one request per second to stay within the geocoding provider's usage limits. By default this uses the public OSM Nominatim service, but it's configurable via the `GEOCODER_URL` environment variable if you'd rather point it at your own instance or another provider.

See [Map & Geocoding](/self-hosting/map-geocoding/) for the full configuration reference.
