---
title: CardDAV Sync
description: Sync contacts with Google, iCloud, Outlook, and other CardDAV servers.
sidebar:
  order: 14
---

Nametag can keep itself in sync with your contacts on an external server using CardDAV, the standard protocol behind Google Contacts, iCloud, Outlook, and many other address books. Sync is bidirectional: changes made in Nametag flow to the server, and changes made on the server flow back into Nametag.

## Supported providers

### Google Contacts

- Server URL: `https://www.googleapis.com/.well-known/carddav`
- Requires an app-specific password. Generate one at **myaccount.google.com > Security > App passwords**.

### iCloud

- Server URL: `https://contacts.icloud.com/`
- Requires an app-specific password. Generate one at **appleid.apple.com > Sign-In and Security > App-Specific Passwords**.

### Outlook / Office 365

- Server URL: `https://outlook.office365.com/`
- Uses your regular password, or an app password if you have two-factor authentication enabled.

### mailbox.org

- Server URL: `https://dav.mailbox.org/`
- Use your full mailbox.org address. With two-factor sign-in turned on, create an app password in your mailbox.org account and use it instead of your normal password.

### Fastmail

- Server URL: `https://carddav.fastmail.com/`
- Requires an app password with access to contacts.

### Posteo

- Server URL: `https://posteo.de:8843/`
- Uses your regular Posteo address and password.

### Nextcloud / Radicale

- Server URL: the address of your instance. For Nextcloud this is your address followed by `/remote.php/dav`.
- Uses your regular credentials, or an app password if two-factor sign-in is on.

### Any standard CardDAV server

If your provider isn't listed, enter its server URL and your credentials directly. Nametag speaks standard CardDAV, so most self-hosted and business address book servers work.

## Setting up a connection

Go to **Settings > CardDAV**. Select a provider preset, or enter a custom server URL. Each preset shows which password to use and links to the place where you create an app password. Enter your username and password (the eye button shows what you typed, handy on a phone), then use **Test Connection** before saving.

The test tells you in plain words what it found, for example "Connection works. Found 123 contacts in 1 address book", with one line per address book when there are several. If the server reports no contacts, the test says so and explains the likely causes (another address book, or a login that cannot see them). If it fails, the message names the cause (wrong login, wrong address, no answer, certificate problem) and what to do next.

When you edit an existing connection you can leave the password empty: the test then uses the saved password, as long as the server address is unchanged.

## Status on the settings page

The settings page shows when the last sync ran ("5 minutes ago", with the exact time shown on hover), whether automatic sync is on, and how many imports and conflicts are waiting. Both are links straight to the matching page. **Sync Now** opens a progress window and ends with a summary; if nothing changed it says that everything is up to date. **Send contacts to server** opens the bulk export.

## Sync settings

Once connected, you can configure:

- **Auto-sync interval**: how often Nametag checks for changes, from every 60 seconds up to once every 24 hours.
- **Auto-export**: automatically push newly created Nametag contacts to your CardDAV server, without a manual export step.
- **Import mode**: how new contacts discovered on the server are handled:
  - **Manual**: review each one before importing.
  - **Notify**: show a notification badge so you know new contacts are waiting.
  - **Auto**: import new contacts immediately, no review needed.

## Conflict resolution

If a contact has changed on both sides (in Nametag and on the CardDAV server) since the last sync, Nametag can't just pick one side automatically. It creates a conflict instead.

Go to **CardDAV > Conflicts**. Each conflict lists only the fields that differ: side by side on a wide screen, stacked on a phone. Fields that are the same on both sides are collapsed. Choose **Keep Local** to send your Nametag version to the server, or **Keep Remote** to update Nametag to match the server. Important dates that are also on the server keep their reminders; dates the server does not have move to the trash instead of being deleted for good. Under each button a line explains what happens.

Nametag recommends a side only when keeping it cannot lose anything: the two versions are the same, or one side merely adds details the other lacks. When both sides changed the same field there is no recommendation, because the sync does not know which edit is newer. The same goes for contacts with a photo, groups or dates: the saved Nametag version does not hold those, so Nametag cannot check them and recommends nothing.

To handle many conflicts at once, use **Apply recommendations that lose nothing**, or **Keep all: Nametag** / **Keep all: server**. The two keep-all buttons ask for confirmation first, because they replace one side for every conflict. Conflicts are resolved one after another with a progress bar; any that fail stay in the list.

## Pending imports

New contacts found on the CardDAV server that don't yet exist in Nametag show up as pending imports. Review them and choose which ones to bring in, rather than importing everything automatically.

The import page walks through four steps: connect (or open the file), choose, assign, done.

- **Choose**: search by name, company, email or phone, and filter by new contacts or contacts already in Nametag. **Select all** only selects the contacts currently shown, so a search narrows what gets picked; contacts selected earlier stay selected, and the counter tells you how many of them are hidden by the search. Open a contact with the arrow to set groups or a relationship for that one person.
- **Assign**: shows how many new and existing contacts will be imported and sets groups and a relationship for all of them. Groups and relationship only apply to new contacts.
- **Done**: contacts are imported in batches of 25 with a progress bar, then a summary shows imported, updated, skipped and failed contacts, any error messages, and links to your contacts and back to the settings. If a request fails half way, the summary keeps what was imported so far and says how many contacts were not processed.

Contacts that already exist in Nametag (matched by their vCard UID) are marked with an "Already in Nametag" badge. You can still select these contacts and check **Update existing contact** (or, in the assign step, update all of them at once) to overwrite the existing record with the data from the import. This is useful when re-importing a VCF file with updated information for a contact you already have.

## Bulk export

If you're setting up sync for the first time and already have contacts in Nametag, use bulk export (**Send contacts to server** on the settings page) to push your existing contacts to the CardDAV server. Search the list, select only the contacts shown, and send them in batches of 25 with a progress bar. A summary lists how many were sent, were already on the server or failed, with the error for each failed contact.

## Sync technical details

| Setting | Value |
| --- | --- |
| Retry attempts | max 3 |
| Retry initial delay | 1 second |
| Retry backoff factor | 2x |
| Retry max delay | 10 seconds |
| Export batch size | 50 contacts per batch on the server; the page sends 25 contacts per request |
| Import batch size | 25 contacts per request |
| Delay between export batches | 100ms |
| Auto-sync interval range | 60 seconds to 24 hours (default: 12 hours) |
| Cron inter-user delay | 200ms between users |

### How Nametag decides a contact changed

Nametag tracks each synced contact's ETag, a version marker the server updates whenever the contact's data changes. When the ETag moves, the contact is pulled back in.

An ETag on its own isn't always a reliable signal. Some servers don't return one when Nametag uploads a contact, and others (Google and iCloud among them) rewrite the contact after receiving it, which moves the ETag even though nothing actually changed. To avoid re-importing contacts it just wrote, Nametag also compares a content fingerprint of the incoming contact against the last version it imported. If the fingerprint matches, it records the new ETag and leaves the contact alone.

This is also why a contact edited only in Nametag won't be flagged as a conflict just because the server reshuffled its copy.

## Troubleshooting

- **Wrong password type**: Google and iCloud require an app-specific password, not your regular account password. If sign-in fails, double-check you generated one and are using it here.
- **Two-factor authentication**: if 2FA is enabled on your account, you'll typically need an app password even for providers that otherwise accept a regular password, like Outlook.
- **Server URL format**: make sure the URL matches what your provider expects, including the trailing slash where shown above. A slightly wrong URL is one of the most common reasons a connection test fails.
