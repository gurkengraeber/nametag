---
title: Search
description: Find contacts quickly with global search.
sidebar:
  order: 11
---

Nametag's global search lets you jump to any contact from anywhere in the app, without clicking through menus.

## Opening search

Press `Cmd+K` on Mac or `Ctrl+K` on Windows and Linux to open the search bar. It works from any page: your dashboard, a person's detail page, settings, wherever you happen to be.

On phones and other narrow screens, tap the magnifying glass in the header. The search field expands to fill the header and is focused straight away, so you can start typing without a second tap. The keyboard shortcut opens that same field when a keyboard is attached, and Escape or Cancel puts it away.

## How it works

Search runs entirely in your browser. When you sign in, Nametag builds a search index from all your contacts using MiniSearch, a lightweight full-text search library, and caches it client-side. That means results appear instantly as you type, with no round trip to the server for every keystroke.

The index rebuilds automatically whenever you add, edit, or delete a contact, so it always reflects your current data.

## Fuzzy matching

Search tolerates typos and partial matches. Typing "jhon" will still surface "John", and a partial name like "sam" will match "Samantha" or "Samuel". You don't need to spell a name exactly right to find who you're looking for. Words of three letters or fewer are matched exactly, so a short name does not drag in unrelated people.

## What search looks at

Search covers names, nicknames, display names, groups, the relationship to you, the city, organization, job title, notes, phone numbers, emails, addresses, links, messenger handles and custom fields. The best matches come first: a person whose name starts with what you typed ranks above someone who only has the word in their notes, and a group or city ranks above a note.

## Reading the results

Each result shows:

- The person's name
- Their photo, or their initials if no photo is set
- A line of context: the relationship to you, their groups and their city (or organization)
- When the word was found outside the name, a short hint such as "In notes", so you can see why the person appears

Click a result, or press `Enter`, to open that person's detail page.

## Recently opened people

Focus the search field without typing anything and it suggests the people you opened last. The list only stores which profiles you opened, in this browser and for your account. It keeps entries for 30 days at most and is cleared when you sign out. Names are always read from the search index, never stored.

## Quick actions

You can change a person right from the search results without opening their profile. Press `Shift+Enter` or `Tab` on a result, or tap the lightning button at the end of its row (the only way on a phone). Three actions appear:

- **Contacted today** sets the last contact date to today. It is disabled when that is already the case.
- **Add to group** lists your groups. Groups the person already belongs to are marked and cannot be picked again.
- **Set relationship** lists your relationship types and sets how the person relates to you.

Use the arrow keys to move through the options and `Esc` to step back. After an action the search index refreshes, so the result shows the new group or relationship straight away.

## When search is slow or unavailable

Until the search index has loaded, Nametag asks the server instead; results then show names only and have no quick actions. If the server cannot be reached, search says so and offers a "Try again" button instead of claiming nobody was found. When nothing matches, the dropdown offers to add the typed name as a new person. If you have no people at all, it points you to adding the first person or importing contacts with CardDAV.

## Technical details

- **Default max results**: 20
- **Fuzzy tolerance**: 0.2 for words of four letters or more, none below
- **Field weights**: name, surname, nickname and display name 3 to 4 times, group, relationship and city 2 times, organization 1.5 times, notes 0.6 times; names that start with the query get an extra bonus
- **Recent people**: up to 8 ids, stored as `nametag:recent-people:<userId>` in local storage
- **Combine mode**: AND (all search words must match)
- **Prefix matching**: enabled, so results appear as you type
- **Indexed fields**: name, surname, middle name, second last name, nickname, display name override, organization, job title, notes, phones, emails, addresses, URLs, IM handles, groups, relationship, city, custom fields
