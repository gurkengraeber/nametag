---
title: Journal
description: Keep a timeline of notes linked to people in your network.
sidebar:
  order: 5
---

The journal is a timeline of notes and reflections, each one optionally linked to the people it's about. It's the place for things that don't belong in a person's permanent record, the small moments, conversations, and observations that build up your understanding of someone over time.

## Creating an entry

A new entry opens with the cursor already in the text field, so you can start typing straight away. An entry has:

- **Entry**: the text itself, written in markdown. This is the only required part
- **People**: tag anyone the entry is about by typing a name, or tap one of the people you wrote about most recently. An entry can mention any number of people, or none at all
- **Date**: defaults to today. You can optionally add a time as well, if it matters when during the day something happened
- **Title**: optional. If you leave it empty, the first line of the entry is used as the title

When you tag at least one person, a checkbox reads "Set last contact to" followed by the entry's date, so writing a journal entry after catching up with someone can double as logging that contact in one step. It applies to everyone tagged and never moves a later last contact date backwards. For an entry dated in the future (a plan, not something that happened) the box starts unchecked.

Press **Ctrl+Enter** (**Cmd+Enter** on a Mac) to save without reaching for the button. **Save** takes you back to the timeline. **Save and add another** keeps the form open with the same day and people, so you can write several entries in a row.

### Linking to a new entry

Other pages can open the form pre-filled:

- `/journal/new?person=<id>` tags that person. Several ids can be separated by commas
- `/journal/new?date=YYYY-MM-DD` chooses the day

After saving, you land in the timeline filtered to the tagged people.

### Drafts

Text you have not saved is kept in your browser, so a reload, a closed tab or a tap on another page does not lose it. The next time you open the form (new entry or edit) the draft comes back with a note and a button to discard it. Drafts are stored per account, expire after seven days, and are removed when you sign out. They stay on the device and are never sent to the server.

## Timeline view

The Journal page lists your entries chronologically, most recent first, grouped by month. Each entry shows its date, a relative time ("yesterday", "3 weeks ago"), its title, a text preview of the body with markdown formatting stripped out, and the people it's tagged with. Long entries are folded: use **Show full entry** to read the rest in place and **Show less** to fold it again. Tapping anywhere else on the card opens the entry.

## Filtering

Three filters, usable together:

- **By person**: select one or more people to narrow the list. This uses AND logic, so if you select two people, only entries that mention both of them appear, not entries mentioning either one
- **By text search**: searches both the title and the body of your entries. Results update as you type, and the matching words are highlighted
- **By time range**: one tap for the last 7 days, the last 30 days or this year. Entries with a time of day are matched by the day in your own time zone. The range is kept in the address (`from`, `to` and `tz`), so a filtered view can be bookmarked

When a filter is active the list shows how many entries match and a link to clear the filters. If nothing matches, you get a button to clear the filters and one to write an entry (with the filtered people already tagged). **Add new entry** also carries the filtered people along.

## Viewing on the person detail page

Every person's detail page has its own journal section showing the most recent entry that mentions them, along with links to view the full filtered timeline for that person or write a new entry directly (pre-filled with them tagged).

## Markdown support

Entry bodies support full markdown rendering: headings, bold and italic text, lists, links, blockquotes, and code. Write with the same markdown editor used elsewhere in Nametag, and it renders properly formatted wherever the entry is displayed.

## Editing and deleting entries

Open an entry to see it in full, with buttons to edit or delete it. Editing reopens the same form used to create the entry, with everything pre-filled. Deleting asks for confirmation first. Right after deleting, a message with an **Undo** button brings the entry back, with its tagged people.

## Field limits

| Field | Limit |
| --- | --- |
| Title | 0-200 characters in the form (an empty title is filled from the first line). The API requires 1-200 |
| Body | 1-50,000 characters (markdown) |
| Pagination (API) | 50 entries per page |
