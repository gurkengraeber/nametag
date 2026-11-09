---
title: Network Graph
description: Visualize your personal network as an interactive graph.
sidebar:
  order: 4
---

The network graph turns your list of people into a picture: a living map of who connects to whom. It shows up in two places, and it works the same way in both.

## Two contexts

- **Dashboard**: you sit at the center, with your entire network radiating outward. This is the big-picture view of everyone you've added. The page is built so that the greeting, a few key figures (people, groups, events this week) and the whole network fit on one screen: the graph takes the height that is left, and your upcoming events sit below it. When the page opens, the graph is framed so that you are in the middle and your network is in view, until you pan or zoom yourself.
- **Person detail page**: the selected person sits at the center instead, showing their direct connections. This is the focused view for understanding one person's place in your network. The window is only as tall as it needs to be: a person with a few connections gets a small graph, one with many connections a taller one.

## Display modes

Nametag offers two ways to render the graph:

- **Individuals**: every person is their own node, connected by edges that represent relationships. This is the default.
- **Bubbles**: people are clustered into bubbles by group membership, so you see clusters instead of a dense tangle of nodes. People who don't belong to any group are collected into their own "Ungrouped" bubble. Click a bubble to expand it into its individual members, and click it again to collapse it back.

You can switch modes from **Settings > Appearance**, or directly from the controls above the graph. As long as you have not chosen a mode yourself, a network with more than 80 people opens as bubbles, because that many individual nodes become a tangle. Your own choice always wins.

## Filtering by group

A pill selector above the graph lets you narrow down who's shown, with a few filter modes working together:

- **Any (OR) mode**: shows people who belong to at least one of the selected groups
- **All (AND) mode**: shows only people who belong to every selected group
- **Negation**: click a selected pill again to flip it from included to excluded, hiding people who belong to that group instead of showing them
- **Ungrouped**: a dedicated filter for people who don't belong to any group at all

A help button next to the filters walks through these modes with visual examples if you ever need a refresher.

## Finding a person

The search field in the top left corner of the dashboard graph finds people by name (accents and capital letters do not matter). Pick a hit and the graph zooms in on that person, centers them and marks them with a ring. In bubble mode the group that contains the person is expanded for you. Clearing the field removes the mark.

## People without a connection

People who have no relationship at all, neither to you nor to anyone else, are not drawn in the graph, because they would only drift far away from everyone else. They are listed under **Not connected** below the graph (the button with the person icon in the bottom left corner of the graph jumps there). Click a name to open the profile, or choose a relationship in the drop-down next to it to connect the person to you right away. The graph then loads again and shows them. While a group filter is active, a person can appear in this list only because their connections lie outside the filter.

## Legend

The legend button in the bottom left corner explains the colors: one entry per group (a node is colored by its first group, people without a group are gray) and one line per relationship type used for the edges.

## Full screen

The button in the top right corner of the dashboard graph shows the graph in full screen, which is handy on a phone. Press **Escape** or use the same button to leave it. Both the legend and the list of unconnected people are available in full screen as well.

## Node and edge appearance

- Each node shows the person's photo, or their initials if they haven't uploaded one
- Nodes are colored by group membership
- Edges are colored by relationship type, so you can tell at a glance whether a connection is family, a friendship, or something else

## Interactions

- **Click a node** to navigate to that person's detail page (clicking the center node on the dashboard takes you to your own dashboard)
- **Drag a node** to rearrange it manually. Nametag's force simulation will let it settle back into place once you let go, unless you've pinned it by moving it
- **Hold Ctrl (Cmd on Mac) and scroll to zoom** in and out. Without the key the mouse wheel scrolls the page, so the graph never traps you while you scroll past it. In full screen the wheel zooms directly, and on a touch screen a vertical swipe scrolls the page while two fingers zoom
- **Drag the background** to pan around
- **Search** a person by name to zoom in on them
- A **recenter button** puts you back in the middle and zooms out far enough to bring your network into view

There are no dedicated keyboard shortcuts beyond these pointer interactions today.

## Technical details

For the curious: the graph is powered by a D3.js force-directed simulation, rendered to an HTML canvas rather than SVG for performance. A level-of-detail (LOD) system simplifies what gets drawn depending on zoom level, showing simple dots when zoomed far out, adding labels at a middle zoom level, and rendering full detail (photos, names, colors) only once you're zoomed in close enough to read them.

## Performance at scale

Canvas rendering combined with the LOD system means the graph stays responsive even for large networks. If you're tracking 100 or more people, expect the same smooth panning and zooming you'd get with a much smaller network, since Nametag only draws full detail for what's actually visible and legible at the current zoom level.

## Limits and constraints

| Item | Value |
| --- | --- |
| Performance warning threshold | 100 nodes |
| Max nodes shown | 500 nodes |
| Default degrees of separation | 2 |
| LOD tier: dots | zoom below 0.6 |
| LOD tier: labels | zoom between 0.6 and 1.2 |
| LOD tier: full detail (with photos) | zoom 1.2 and above |
