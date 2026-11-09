---
title: People
description: How to add, edit, and manage contacts in Nametag.
sidebar:
  order: 1
---

People are the heart of Nametag. Everything else, groups, relationships, the network graph, exists to help you understand and stay close to the people you add here.

## Creating a contact

The only thing you have to type is a name. Everything else is optional, so you can jot down a name in a few seconds and come back to fill in the rest whenever you have time (or never, if you don't need to).

The form for a new person opens with the cursor in the name field and shows just the essentials: name, surname, nickname, your relationship to the person and their groups. Press Enter in the name field to save. Everything else (photo, phones and emails, last contact, important dates, notes, work info, addresses, websites, custom fields) sits behind **More details**, in sections you can unfold one by one. Rarely used name parts (prefix, middle name, second last name, suffix, display name override) are folded under **More name fields**.

**Create and add another** saves the person and opens a fresh form, which is the quickest way to enter several people in a row.

Nametag remembers the relationship and groups you used last for a new person and preselects them the next time. Only the IDs are kept, in your browser, per account, and they are discarded after 30 days. A relationship type is still needed to save, because it is what connects the new person to you.

Press Enter inside a phone, email, address or website entry to add that entry. It does not save the whole person.

When the server rejects a value (for example a name that is too long), the message appears directly at that field and the form scrolls to it.

### Name fields

Nametag's name handling is flexible enough for real-world naming conventions, not just "first name, last name":

- **Name**: first name (required)
- **Surname**: last name
- **Middle name**
- **Second last name**: for Spanish naming customs, where a person carries both a paternal and maternal surname
- **Prefix / suffix**: honorifics like Dr. or Jr.
- **Nickname**: what you actually call them
- **Display name override**: forces a specific string to be shown everywhere in the app instead of the name built from the fields above

### Work info

Organization and job title, if you want to keep track of where someone works and what they do there.

## Multi-value contact fields

Phones, emails, addresses, URLs, and IM handles all support multiple entries per person, each tagged with a type:

- **Phones**: Mobile, Home, Work, Fax, Other
- **Emails**: Personal, Work, Other
- **Addresses**: Home, Work, Other. Each address is structured into street lines, city, state or region, postal code, and country, so it can be geocoded and shown on the Map
- **Websites**: Personal, Work, Other
- **IM handles**: tagged by protocol (Skype, WhatsApp, Telegram, Signal, and others)

Add as many of each as you need. There's no limit on how many phone numbers or emails a single person can have.

## Important dates

Birthdays, anniversaries, and any custom date worth remembering (a first meeting, a memorial, whatever matters to you) live on the person record. See [Important Dates](/features/important-dates/) for reminders and recurrence options.

## Notes

Notes support markdown with a live preview, so you can format lists, links, and emphasis while writing down context about a person: how you met, what they care about, things to remember for next time.

## Last contact

Nametag tracks the date you last spoke with or saw someone. On the person detail page, a quick-update button lets you mark "contacted today" in a single click, without opening the edit form. The date is shown with how long ago it was, for example "3 months ago".

## Photos

Every person can have a photo, uploaded and cropped directly in the app. See [Photos](/features/photos/) for details on formats and cropping.

## Custom field values

If you've defined custom field templates in Settings (text, number, boolean, or select fields), each person's edit page shows an input for every template so you can fill in values specific to your own workflow. See [Custom Fields](/features/custom-fields/) for how to define templates.

## The people list

The People page shows everyone in your network, 50 per page.

**Columns adapt to your screen width.** On wide screens the list breaks names into separate Name, Surname and Nickname columns, so each one can be sorted on its own. On narrow screens there is no room for all three, so they collapse into a single **Full Name** column showing the complete name. That column follows your [name order and name display format](/features/settings/) settings, so a Short name display format shows only the nickname or first name there too.

**Quick editing.** The Relationship, Last contact and Location columns can be changed right in the list, so you don't have to open each profile. Pick a relationship from the drop-down, set the last contact date or press **Today**, and type a city and country. Each change is saved as soon as you leave the field. Location edits the person's first address and adds one if there is none yet.

**Sorting** is available by:

- Name
- Surname
- Nickname
- Relationship (your relationship to the person)
- Group
- Last contact

**Filtering** narrows the list down by:

- Group (including an option to show only people who don't belong to any group)
- Relationship type (including an option to show only people with no set relationship to you)
- Custom field value, using a URL parameter in the form `?cf=slug:value`

## Bulk actions

Select multiple people from the list to delete them, assign them to a group, or assign a relationship type all at once. See [Bulk Actions](/features/bulk-actions/) for the full workflow.

## Unsaved changes protection

When creating or editing a person, Nametag warns you before navigating away if you have unsaved changes. This applies to the browser back button, links, the Cancel button, page refresh, and closing the tab. If nothing has changed (preselected remembered values do not count), navigation proceeds without a prompt. In the edit form, Cancel returns to the person.

## The person detail page

The detail page for a person brings every section together in one place: name and photo, work info, contact information, addresses, important dates, notes, custom field values, group memberships, your relationship to them, their relationships to other people, and a journal timeline of entries linked to them. It's designed to give you the full picture of a person at a glance.

**Summary under the name.** Job title and organization, where they live (from their first address), their next important date ("Birthday in 12 days") and **Call** and **Email** buttons for their first phone number and email address.

**Quick actions without the edit form.** Directly below the header you can change your relationship to the person, set the last contact to today, add or remove groups (or create a new group on the spot) and append a note. Every change is saved immediately and confirmed with a short message. A new note is added to the end of the existing notes, separated by a blank line.

**Tappable contact details.** Phone numbers and email addresses open your phone or mail app. Telegram and Skype handles are links, and mobile numbers offer WhatsApp, Telegram and Signal. Touch targets are larger on phones.

**Connections.** A person with six or more connections shows them grouped under one heading per relationship type, otherwise they are listed as sentences ("Anna is Max's friend").

## Field limits

| Field | Limit |
| --- | --- |
| Name (first name) | 1-100 characters |
| Surname, middle name, second last name, nickname | up to 100 characters each |
| Prefix, suffix | up to 50 characters each |
| Display name override | up to 200 characters |
| Organization, job title | up to 200 characters each |
| Notes | up to 10,000 characters (markdown supported) |
| Phone number | 1-50 characters |
| Phone/email/address/URL type labels | 1-50 characters |
| Street address (per line) | up to 200 characters |
| City, region, country | up to 100 characters each |
| Postal code | up to 20 characters |
| URL | 1-500 characters |
| IM handle | 1-200 characters |
| Pagination | 50 contacts per page |

**Type options:**

- **Phone types**: Mobile, Home, Work, Fax, Other
- **Email types**: Personal, Work, Other
- **Address types**: Home, Work, Other
- **URL types**: Personal, Work, Other
- **IM protocols**: Skype, WhatsApp, Telegram, Signal, Other
