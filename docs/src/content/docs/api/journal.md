---
title: Journal
description: API endpoints for creating and managing journal entries.
sidebar:
  order: 6
---

The Journal is a timeline of notes optionally linked to one or more people. Entries support markdown and can be filtered by person or searched by text.

All endpoints require authentication and operate only on the authenticated user's own entries.

## List journal entries

```
GET /api/journal
```

Returns entries ordered by date descending. This is the one list endpoint in the API that paginates, see [Pagination](/api/overview/#pagination).

**Query parameters**

| Parameter | Type | Description |
| --- | --- | --- |
| `page` | integer | Page number, defaults to 1. Page size is fixed at 50. |
| `person` | string | Filter to entries tagging this person ID. Pass several IDs separated by commas to get only entries that tag all of them. |
| `q` | string | Search text in title and body. |
| `from` | string | First calendar day to include, as `YYYY-MM-DD`. Compared as a UTC day unless `tz` is set. Invalid values are ignored. |
| `to` | string | Last calendar day to include, as `YYYY-MM-DD`. Compared as a UTC day unless `tz` is set. Invalid values are ignored. |
| `tz` | string | IANA time zone such as `Europe/Berlin`. Entries with a time of day are compared to `from` and `to` as days of this zone instead of UTC days. Entries without a time always use their calendar day. Unknown zones are ignored. |

```bash
curl "https://your-instance.example.com/api/journal?page=1&person=clx1" \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "entries": [
    { "id": "clxj1", "title": "Coffee with Ada", "date": "2026-07-18T09:00:00.000Z", "body": "Caught up on..." }
  ],
  "pagination": { "page": 1, "pageSize": 50, "totalCount": 1, "totalPages": 1 }
}
```

## Create a journal entry

```
POST /api/journal
```

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Required, 1-200 characters. |
| `date` | string | Required. |
| `hasTime` | boolean | Whether `date` includes a meaningful time of day, or is calendar-day-only. Defaults to `false`. |
| `body` | string | Required, up to 50,000 characters. Markdown supported. |
| `personIds` | string[] | People tagged in this entry. Defaults to `[]`. |
| `updateLastContact` | boolean | Whether to bump `lastContact` for tagged people. Defaults to `true` on create. |

```bash
curl -X POST https://your-instance.example.com/api/journal \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Coffee with Ada",
    "date": "2026-07-18T09:00:00.000Z",
    "hasTime": true,
    "body": "Caught up on her latest project.",
    "personIds": ["clx1"]
  }'
```

```json
{ "entry": { "id": "clxj1", "title": "Coffee with Ada", "people": [ { "id": "clx1", "name": "Ada" } ] } }
```

## Get a journal entry by ID

```
GET /api/journal/{id}
```

```bash
curl https://your-instance.example.com/api/journal/clxj1 \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "entry": { "id": "clxj1", "title": "Coffee with Ada" } }
```

## Update a journal entry

```
PUT /api/journal/{id}
```

Same body as create. Note that `updateLastContact` defaults to `false` on update, unlike create where it defaults to `true`.

```bash
curl -X PUT https://your-instance.example.com/api/journal/clxj1 \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Coffee with Ada",
    "date": "2026-07-18T09:00:00.000Z",
    "body": "Caught up on her latest project. She is starting a new one soon.",
    "personIds": ["clx1"]
  }'
```

```json
{ "entry": { "id": "clxj1", "body": "Caught up on her latest project. She is starting a new one soon." } }
```

## Delete a journal entry

```
DELETE /api/journal/{id}
```

Soft-deletes the entry. It can be brought back with the restore endpoint below.

```bash
curl -X DELETE https://your-instance.example.com/api/journal/clxj1 \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "message": "Journal entry deleted" }
```

## Restore a journal entry

```
POST /api/journal/{id}/restore
```

Brings back a soft-deleted entry together with its tagged people. Returns `404` if the entry does not exist or belongs to someone else, and `400` if it is not deleted.

```bash
curl -X POST https://your-instance.example.com/api/journal/clxj1/restore \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "entry": { "id": "clxj1", "title": "Coffee with Ada", "deletedAt": null } }
```
