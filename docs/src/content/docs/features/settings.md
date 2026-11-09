---
title: Settings
description: Configure your Nametag experience.
sidebar:
  order: 16
---

Settings is where you shape Nametag around how you work. Here's what you'll find in each section.

## Finding a setting

The start page (**Settings** in the account menu) lists every area under four headings: *You* (profile, security, billing), *Preferences* (appearance, notifications, custom fields, map), *Connections* (CardDAV, API tokens) and *Data and help* (account, trash, about). Each row has a one line explanation. The search box above the list finds a setting by name or by everyday words, so typing "password", "language" or "reminders" takes you to the right place.

On a phone the start page is the menu: tap an area, and use **All settings** at the top to come back. On a larger screen the same groups appear in the sidebar, with **Overview** at the top.

## How changes are saved

- **Choices that apply at once** (theme, date format, name style, graph display, language, reminder timing, channel switches) save the moment you pick them and confirm with a short message. If saving fails, the choice jumps back and the message says so.
- **Forms with a Save button** (profile, password) show **You have unsaved changes** next to the button until you save, offer **Discard changes**, and ask before you leave the page with unsaved edits. Errors appear under the field they belong to, for example a taken email address or a wrong current password.

## Profile

Your name, surname, nickname, email address, and profile photo. Use **Upload photo** or **Change photo** under your picture (it works the same on a phone); you can crop it before saving, and the photo is stored when you press **Save changes**. Changing the email address signs you out until you confirm the new one, and the form tells you so while you type.

## Appearance

- **Theme**: Dark or Light, shown as two small previews. Dark is the default.
- **Language**: choose from all of Nametag's supported languages, including English, Spanish, Japanese, Norwegian, German, Chinese, Italian, Russian, Dutch, French, and Polish.
- **Date format**: MDY, DMY, or YMD.
- **Names**: name order (Western or Eastern) and name display format (Full name, Nickname Preferred, or Short) sit in one card. An example name ("Maria 'Mia' Garcia") above the choices updates as you choose, showing how a name reads on a person's page and in lists and the graph.

### Graph mode

Also configured from Appearance, graph mode controls how your network graph renders: **Individuals** shows each person as their own node, while **Bubbles** groups people together by their group membership. See [Network Graph](/features/network-graph/) for more.

### Install app

Shows how to add Nametag to your home screen or desktop. On Android and desktop this is an install button; on iOS it is step-by-step instructions, because Safari has no install API. If you are already running the installed app, this section just confirms that. See [Installing the App](/features/install/).

## Notifications

At the very top, one line says where reminders will actually arrive (for example "email and push on 2 devices"), and warns you if no channel is on. Below it, a delivery channels card lets you turn email and browser push on or off, and manage which devices receive push. See [Notifications](/features/notifications/) for how those channels work.

Below that, two settings, both about email.

- **Advance notice**: how many days before an important date you want to hear about it, chosen from On the day only, 1 day before, 3, 7, 14, or 30 days before. Advance notice never replaces the day-of reminder. Choosing 7 days before means you get an email 7 days before the event and again on the day itself, always both. The page spells this out directly under the control so you never have to guess.
- **Weekly summary**: an opt-in email summarizing what's coming up in the next 7 days, off by default. Turning it on reveals a day-of-week picker for when it should arrive. If a given week has nothing coming up, no email is sent that week. Silence is the expected behavior for a quiet week, not a sign anything is broken.

The weekly summary's send hour follows the self-hosted instance's own cron schedule, not each user's personal timezone. See [Cron Jobs](/self-hosting/cron-jobs/) for how that's configured.

If the instance has no email delivery configured (no SMTP or Resend, see [Email](/self-hosting/email/)), both controls are shown disabled with an explanation, since there is no point turning on a notification that can never arrive.

## Security

### Changing your password

Change your password. You'll need to enter your current password to confirm the change. Changing your password (or resetting it by email) signs you out on every other browser and device, including the mobile app. The browser or app you changed it in stays signed in.

### Signed-in devices

Every Nametag app you sign in to on a phone shows up here, with its platform, app version, when it was last used and when it signed in. Use **Sign out** next to a device you don't recognize, or **Sign out all devices** to sign out every app at once. The app on that device will need to sign in again.

Browser sessions aren't listed here.

## CardDAV

Manage your connection to an external CardDAV server and configure sync behavior. See [CardDAV Sync](/features/carddav/) for the full picture.

## Custom Fields

Define the field templates that appear on every person's profile. When you add a field you can start from an example (diet, allergies, has pets, shoe size, gift ideas) that fills in the name, type and options. Each type explains itself, and the arrows next to a field change the order. See [Custom Fields](/features/custom-fields/) for details.

## Map

A per-user toggle for geocoding, which controls whether Nametag looks up coordinates for addresses to plot them on the map view.

## API Tokens

Create and manage tokens for accessing the Nametag API programmatically. Pick an expiry (never, 30 days, 90 days, 1 year, or a date), and choose read-only or read and write access; the form says in one sentence what each allows. A new token is shown once, with a Copy button, so store it right away. Revoking a token asks for confirmation. See the API Tokens page for setup details.

## Account

- **Export data**: download your data as JSON or vCard. See [Import & Export](/features/import-export/).
- **Import data**: upload a JSON or vCard file. See [Import & Export](/features/import-export/).
- **Delete account**: permanently removes your account and data. The page suggests exporting a copy first and tells you how many people and groups will go. It requires typing "DELETE" to confirm and entering your password, a deliberate double check before something irreversible happens.

## Billing

Available in SaaS mode only, on nametag.one. Shows your current plan, usage meters against your plan's limits, options to upgrade or downgrade, payment history, and a place to enter promo codes. Self-hosted installations don't show this section since all features are unlimited.

## About

App version, license information, and links to the GitHub repository, release notes, and changelog.

## Preference options

| Setting | Options |
| --- | --- |
| Theme | Light, Dark |
| Date format | MDY, DMY, YMD |
| Name order | Western (first, then last), Eastern (last, then first) |
| Name display | Full, Nickname Preferred, Short |
| Graph mode | Individuals, Bubbles |
| Supported languages | English, Spanish, Japanese, Norwegian, German, Chinese, Italian, Russian, Dutch, French, Polish (11 total) |
| Advance notice | On the day only, 1, 3, 7, 14, or 30 days before |
| Weekly summary | Off (default) or on, with a day of the week to send it |
