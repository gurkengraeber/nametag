---
title: Duplicate Detection
description: Find and merge duplicate contacts.
sidebar:
  order: 13
---

Over time, especially after imports, it's easy to end up with the same person entered twice. Nametag helps you find and clean those up.

## Finding duplicates across your whole network

From the People page, open **Find Duplicates** to scan all your contacts for pairs that look like the same person, based on similarities in their names and details such as email, phone, and birthday.

Suggestions are sorted by how sure Nametag is: "Very likely", "Probably" and "Possibly the same person". Every pair says why it was flagged, for example "same name and same email address", and shows the match percentage. The page also tells you how many suggestions are still open.

## Per-person duplicates

You don't have to run a full scan to catch a duplicate. On any person's detail page, Nametag also surfaces potential duplicates for that specific contact, so you can deal with them one at a time as you notice them.

## Merging in one step

Tap **Merge now** on a suggestion to open a short preview. Nametag keeps the contact with more details, takes the more recently edited value wherever the two disagree (and the later date for last contact), and lists what will happen: which details are added, how many group memberships and relationships move over, and that journal entries mentioning the other contact will mention the kept one. Tap **Keep (name) instead** to swap which contact survives, or **Review every field** to open the full merge page. A merge cannot be undone.

## Dismissing false positives

Not every similar pair is actually a duplicate. If a pair is flagged but you know they're two different people, tap **Not duplicates**. Dismissed pairs won't be suggested again. A message with an **Undo** button appears for a few seconds in case you tapped by mistake.

## Merging two contacts

**Review** opens a full comparison. First pick the contact to keep. Fields where the two contacts disagree are shown as two tappable cards, with the newer value already selected; tap the other card to use it instead. Fields that are identical or filled in on only one side are collapsed into a single line, and the summary at the bottom lists exactly what will happen before you confirm.

Merging combines everything into the surviving contact:

- All relationships
- Group memberships
- Journal entries
- Custom field values
- Contact details (phones, emails, addresses, and more)

The other contact is moved to the trash once the merge completes. Because its details were moved over, restoring it from the trash does not undo the merge.

## Orphan detection

Merging and general cleanup can sometimes leave contacts stranded: people with no relationships and no group memberships. Nametag can find these orphaned contacts for you, either for a single person or in bulk across your whole network, so you can decide whether to connect them to your network or remove them.

## Algorithm details

Nametag scores potential duplicate pairs using Levenshtein edit-distance combined with composite signal scoring across several fields.

| Signal | Weight |
| --- | --- |
| Name | 40% |
| Email | 30% |
| Phone | 20% |
| Birthday | 10% |

The name signal itself is broken down further: first name contributes a weight of 0.6 to the name score, surname contributes 0.4.

Other rules that affect the final score:

- **Similarity threshold**: pairs scoring below 75% are not flagged as duplicates
- **Sparsity cap**: if fewer than 2 signals are available for comparison, the score is capped at 60%
- **Auto-flag on email match**: a matching email boosts the score to at least 85%
- **Name-only bypass**: if name similarity exceeds 95%, the pair is flagged regardless of how the other signals score

When more than two contacts turn out to be related, Nametag groups them with a Union-Find (disjoint-set) clustering algorithm, so a chain of similar entries is presented as a single cluster instead of overlapping pairs.
