---
title: Map
description: API endpoint for retrieving plottable map markers for your network.
sidebar:
  order: 7
---

The Map plots geocoded addresses and saved locations across your network. Addresses you add to a person are geocoded automatically in the background; this endpoint returns whatever has finished geocoding so far.

## Get map markers

```
GET /api/map/markers
```

Returns all plottable points for the current user: successfully geocoded addresses and vCard `GEO` locations, the groups each point's person belongs to, and counts of addresses still pending or failed geocoding. It also returns what the map needs to edit contacts in place: all contacts, every group and relationship type, and the contacts that have no marker.

```bash
curl https://your-instance.example.com/api/map/markers \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "markers": [
    {
      "id": "addr_clxaddr1",
      "source": "address",
      "personId": "clx1",
      "personName": "Ada Lovelace",
      "latitude": 51.5074,
      "longitude": -0.1278,
      "label": "Home",
      "city": "London",
      "region": null,
      "country": "United Kingdom",
      "groupIds": ["clxgroup1"]
    }
  ],
  "groups": [ { "id": "clxgroup1", "name": "Family" } ],
  "allGroups": [ { "id": "clxgroup1", "name": "Family", "color": null } ],
  "relationshipTypes": [ { "id": "clxrel1", "label": "Friend", "color": null } ],
  "people": [
    {
      "personId": "clx1",
      "personName": "Ada Lovelace",
      "groupIds": ["clxgroup1"],
      "relationshipTypeId": "clxrel1",
      "lastContact": "2026-09-14"
    }
  ],
  "unplacedPeople": [
    {
      "personId": "clx2",
      "personName": "Grace Hopper",
      "reason": "noAddress",
      "addresses": []
    }
  ],
  "pendingCount": 2,
  "failedCount": 0,
  "geocodingEnabled": true
}
```

**Response fields**

| Field | Description |
| --- | --- |
| `markers[].id` | `addr_<addressId>` for a geocoded street address, or `loc_<locationId>` for a manually entered GEO location. |
| `markers[].source` | `address` or `location`. |
| `allGroups` | Every group of the user, including groups nobody on the map belongs to. `groups` only lists groups of people that appear in the data. |
| `relationshipTypes` | The user's relationship types (id, label, color). |
| `people[]` | All contacts, located or not: `groupIds`, `relationshipTypeId` (null for none) and `lastContact` as `YYYY-MM-DD` (null when never recorded). |
| `unplacedPeople[]` | Contacts without any marker. `reason` is `noAddress`, `pending` (waiting for the geocoder), `failed` (could not be located) or `disabled` (the user turned locating off). `addresses` holds their existing addresses in the shape the person update route accepts. |
| `pendingCount` | Number of addresses still waiting to be geocoded. |
| `failedCount` | Number of addresses that failed geocoding (invalid or unresolvable). |
| `geocodingEnabled` | Whether automatic geocoding is enabled instance-wide and for this user. See [Settings](/features/settings/) and [Map Geocoding](/self-hosting/map-geocoding/) for configuration. |

If `geocodingEnabled` is `false`, `markers` will only include manually entered GEO locations, since street addresses are never sent to a geocoding provider.

## Editing from the map

The map does not use a dedicated write route. It edits contacts through the regular routes:

- Last contact and relationship: `PUT /api/people/{id}` with a partial body such as `{ "lastContact": "2026-11-09" }` or `{ "relationshipToUserId": "<id>" }`.
- Groups: `POST /api/people/bulk` with `action: "addToGroups"` and an explicit `personIds` list.
- Relationship for many people: `POST /api/people/bulk` with `action: "setRelationship"`.
- A place for a contact without one: `PUT /api/people/{id}` with the complete `addresses` list. The route replaces all addresses of a person, so send the existing ones along; geocoding starts in the background and the marker appears once it has finished.
