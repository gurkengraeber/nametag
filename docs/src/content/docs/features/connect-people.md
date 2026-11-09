---
title: Connect People
description: Link people to each other quickly by dragging or tapping their cards.
sidebar:
  order: 3.5
---

The Connect page is the fastest way to set many person-to-person relationships. It shows your people as small cards, and you link two of them by dropping one onto the other. Open it with **Connect people** at the top of the People page (the address is `/people/connect`).

## The cards

Each card shows a person's name, how they relate to you (if they do) and how many people they are connected to. Use the search field to find people by name or nickname, and the group menu to narrow the list to one group. The line above the cards says how many of your people are shown, so even with a few hundred people the right ones are quickly in view. Filters and scroll position stay as they are while you link people.

## Dragging

Press a card, drag it onto another card and let go. A copy of the card follows your pointer, and the card underneath is outlined so you can see where you are about to drop. When you let go, a small window next to that card asks how the two are related; on a phone it opens as a sheet at the bottom of the screen.

- **Mouse or pen:** move the pointer a few pixels with the button held and the drag starts. A plain click does not start one.
- **Touch:** rest your finger on a card for a moment, then drag. A finger that starts moving right away is a normal scroll, so the list still scrolls as usual. While a card is being dragged the page does not scroll with it, but moving the card near the top or bottom edge of the screen scrolls the list for you.
- Dropping a card on itself, or anywhere that is not a card, does nothing. Press **Escape** to cancel a drag.

## Tapping instead of dragging

Tap or press **Enter** on a card to choose it as the first person; it is marked, and a bar reminds you who is selected. Tap a second card to choose the other person and the same window opens. Tap the selected card again, press **Escape** or use **Cancel** to start over. Every card is a button that can be reached with the keyboard.

## Choosing the relationship

The window reads "Anna → Ben" and the relationship types are shown as chips. The ones you used most recently come first, and the order is remembered in your browser. Past six types a search field appears; press **Enter** in it to pick the first match. Tap a chip to create the relationship.

Nametag creates the other direction for you using the type's inverse, and tells you what was created, for example "Anna is Ben's Parent, Ben is Anna's Child". Hover over or focus a chip to see this before you choose.

If the two people are already connected, the window says how ("Already connected: ..."), and the types that exist in this direction are greyed out so nothing is created twice.

## Brush mode

If you have many pairs with the same relationship, for example ten colleagues, pick one relationship type in the **Brush mode** bar above the cards (the four most recent types are one tap away). While it is on, the bar is highlighted and every drop or pair of taps links the two people with that type at once, with no window. Use **Stop** to leave brush mode.

## Undo

After each link, a message appears with **Undo**. The last ten links of your visit are also listed under **Just linked**, each with its own Undo. Undoing removes both directions again.

If the two people were already connected through a different relationship, the new link cannot be undone safely with one tap, because removing a relationship also removes the one pointing back the other way. In that case there is no Undo button, and you can remove the link on the person's page.

## Technical details

The page uses the existing [relationship API](/api/relationships/) (`POST /api/relationships` to link, `DELETE /api/relationships/{id}` to undo) and needs no extra endpoints. It loads at most the relationships between your own, non-deleted people. The remembered order of recent relationship types is stored per account in your browser's local storage, as ids only.
