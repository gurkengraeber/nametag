'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  forceSimulation, forceLink, forceManyBody, forceCenter,
  forceCollide, forceX, forceY, type Simulation,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomTransform, type ZoomBehavior } from 'd3-zoom';
import { drag } from 'd3-drag';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import PillSelector from './PillSelector';
import { GraphFilterGroupPill } from './GraphFilterPills';
import { paintFrame } from './graph/canvas-renderer';
import { getLODTier } from './graph/lod';
import { computeFitTransform, computeFocusTransform } from './graph/fit-view';
import { computeCanvasHeight, computeCompactHeight, COMPACT_MIN_HEIGHT } from './graph/canvas-height';
import { shouldZoomOnWheel, canvasTouchAction } from './graph/interaction';
import { splitLoosePeople } from './graph/loose-people';
import { buildGraphLegend } from './graph/legend';
import GraphSearch from './GraphSearch';
import GraphLegend from './GraphLegend';
import GraphLoosePeople from './GraphLoosePeople';
import { getCachedPhoto, loadPhoto } from './graph/photo-cache';
import { buildQuadtree, findNodeAtPoint, type NodeQuadtree } from './graph/hit-test';
import { diffSimulationData } from './graph/diff-simulation';
import { resolveGraphMode } from './graph/mode-resolution';
import { buildSimulationNodes, type RawGraphPerson } from './graph/bubble-composition';
import { buildHubAndSpokeEdges } from './graph/edge-composition';
import { UNGROUPED_SYNTHETIC_ID, edgeEndpointId } from './graph/simulation-types';
import type { SimulationNode, SimulationEdge } from './graph/simulation-types';

// Props interface — unchanged from pre-rewrite file
interface Group { id: string; name: string; color: string | null; }
type IncludeMode = 'or' | 'and';
type GroupFilterItem = { id: string; label: string; color: string | null; isNegative: boolean; };

interface UnifiedNetworkGraphProps {
  apiEndpoint?: string;
  groups?: Group[];
  centerNodeNonClickable?: boolean;
  linkDistance?: number;
  chargeStrength?: number;
  refreshKey?: number;
  graphMode?: 'individuals' | 'bubbles' | null;
  compact?: boolean;
}

// While the layout is still moving the view is re-fitted every few ticks, so
// the network is in view from the first frame on, even when ticks are slow
const AUTO_FIT_TICK_INTERVAL = 4;

export default function UnifiedNetworkGraph({
  apiEndpoint,
  groups,
  centerNodeNonClickable = false,
  linkDistance = 160,
  chargeStrength = -400,
  refreshKey,
  graphMode: graphModeProp = null,
  compact = false,
}: UnifiedNetworkGraphProps) {
  const t = useTranslations('dashboard.graph');
  const tPeople = useTranslations('people');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const looseSectionRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Simulation state
  const simRef = useRef<Simulation<SimulationNode, SimulationEdge> | null>(null);
  const nodesRef = useRef<SimulationNode[]>([]);
  const edgesRef = useRef<SimulationEdge[]>([]);
  const quadtreeRef = useRef<NodeQuadtree | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomBehaviorRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const touchSelectedNodeIdRef = useRef<string | null>(null);
  const dirtyRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);
  const unpinTimeoutRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  // Set as soon as the user pans, zooms or drags, so the automatic framing of
  // the network never takes their view away from them. A fresh data load
  // clears it again.
  const userMovedViewRef = useRef<boolean>(false);
  // Person picked through the search. Drawn with a ring and kept in the middle
  // while the layout settles, until the user moves the view.
  const focusedNodeIdRef = useRef<string | null>(null);
  const focusMovedRef = useRef<boolean>(false);
  // Person hidden inside a collapsed group bubble, focused once it is expanded
  const pendingFocusRef = useRef<string | null>(null);

  // Filter state
  const [selectedGroupFilters, setSelectedGroupFilters] = useState<GroupFilterItem[]>([]);
  const [includeMode, setIncludeMode] = useState<IncludeMode>('or');
  const [isMobile, setIsMobile] = useState(false);
  const capitalizeType = useLocale().startsWith('de');

  // Bubble state
  const [expandedBubbles, setExpandedBubbles] = useState<Set<string>>(new Set());
  const [localGraphMode, setLocalGraphMode] = useState<'individuals' | 'bubbles' | null>(graphModeProp);
  const rawCacheRef = useRef<{ nodes: RawGraphPerson[]; edges: SimulationEdge[] } | null>(null);

  // Dashboard tools (search, legend, list of unconnected people, full screen)
  // exist only where the group list is passed in
  const isDashboard = Boolean(groups);
  const [graphPeople, setGraphPeople] = useState<RawGraphPerson[] | null>(null);
  const [graphEdges, setGraphEdges] = useState<SimulationEdge[]>([]);
  const [loosePeople, setLoosePeople] = useState<RawGraphPerson[]>([]);
  const [looseOpen, setLooseOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasHeight, setCanvasHeight] = useState<number | null>(null);
  const [compactHeight, setCompactHeight] = useState<number>(COMPACT_MIN_HEIGHT + 40);
  const [zoomHintVisible, setZoomHintVisible] = useState(false);
  const zoomHintTimerRef = useRef<number | null>(null);
  const isFullscreenRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  // People shown in the network (without you and without the unconnected ones)
  const [networkSize, setNetworkSize] = useState<number | undefined>(undefined);
  const prevFullscreenRef = useRef(false);
  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
    const canvas = canvasRef.current;
    if (canvas) canvas.style.touchAction = canvasTouchAction(isFullscreen);
  }, [isFullscreen]);
  useEffect(() => () => {
    if (zoomHintTimerRef.current !== null) window.clearTimeout(zoomHintTimerRef.current);
    // The layout keeps ticking on its own timer until it is stopped
    simRef.current?.stop();
  }, []);

  // Ungrouped label for bubble composition
  const ungroupedLabel = t('unsortedBubbleLabel');

  const includeGroupIds = useMemo(
    () => selectedGroupFilters.filter((f) => !f.isNegative).map((f) => f.id),
    [selectedGroupFilters],
  );
  const excludeGroupIds = useMemo(
    () => selectedGroupFilters.filter((f) => f.isNegative).map((f) => f.id),
    [selectedGroupFilters],
  );

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Recenter simulation when canvas resizes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new ResizeObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const sim = simRef.current;
        if (!sim || isDraggingRef.current) return;

        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        type CenterForce = ReturnType<typeof forceCenter<SimulationNode>>;
        type XForce = ReturnType<typeof forceX<SimulationNode>>;
        type YForce = ReturnType<typeof forceY<SimulationNode>>;

        const center = sim.force('center') as CenterForce | undefined;
        if (center) center.x(w / 2).y(h / 2);

        const fx = sim.force('centerX') as XForce | undefined;
        if (fx) fx.x(w / 2);

        const fy = sim.force('centerY') as YForce | undefined;
        if (fy) fy.y(h / 2);

        sim.alpha(0.3).restart();
      }, 150);
    });

    observer.observe(canvas);
    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  const moveView = useCallback((target: ZoomTransform, animate: boolean) => {
    const canvas = canvasRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!canvas || !zoomBehavior) return;
    const selection = select(canvas);
    if (animate) {
      selection.transition().duration(500).call(zoomBehavior.transform, target);
    } else {
      selection.call(zoomBehavior.transform, target);
    }
  }, []);

  // Put "you" in the middle of the canvas and bring the network into view
  const fitView = useCallback((animate: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const linkedIds = new Set<string>();
    for (const edge of edgesRef.current) {
      linkedIds.add(edgeEndpointId(edge.source));
      linkedIds.add(edgeEndpointId(edge.target));
    }
    const fitNodes = nodesRef.current.map((n) => ({
      x: n.x,
      y: n.y,
      isCenter: n.kind === 'person' && n.isCenter,
      loose: !linkedIds.has(n.id),
    }));
    const fit = computeFitTransform(fitNodes, {
      width: rect.width,
      height: rect.height,
      padding: isMobile ? 36 : undefined,
    });
    moveView(zoomIdentity.translate(fit.x, fit.y).scale(fit.k), animate);
  }, [isMobile, moveView]);

  // Put one person in the middle and zoom in on them
  const applyFocus = useCallback((personId: string, animate: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const node = nodesRef.current.find((n) => n.kind === 'person' && n.id === personId);
    if (!node || node.x === undefined || node.y === undefined) return;
    focusedNodeIdRef.current = personId;
    focusMovedRef.current = false;
    // The automatic framing of the whole network must not take this view away
    userMovedViewRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const focus = computeFocusTransform(
      { x: node.x, y: node.y },
      { width: rect.width, height: rect.height, currentScale: transformRef.current.k },
    );
    moveView(zoomIdentity.translate(focus.x, focus.y).scale(focus.k), animate);
    dirtyRef.current = true;
  }, [moveView]);

  const clearFocus = useCallback(() => {
    focusedNodeIdRef.current = null;
    pendingFocusRef.current = null;
    dirtyRef.current = true;
  }, []);

  const focusPerson = useCallback((personId: string) => {
    const visible = nodesRef.current.some((n) => n.kind === 'person' && n.id === personId);
    if (visible) {
      applyFocus(personId, true);
      return;
    }
    // Hidden inside a collapsed group bubble: open that group first
    const person = rawCacheRef.current?.nodes.find((n) => n.id === personId);
    if (!person) return;
    pendingFocusRef.current = personId;
    const groupId = person.groups[0] ?? UNGROUPED_SYNTHETIC_ID;
    setExpandedBubbles((prev) => new Set(prev).add(groupId));
  }, [applyFocus]);

  const toggleFilterSign = (id: string) => {
    setSelectedGroupFilters((prev) =>
      prev.map((filter) =>
        filter.id === id
          ? { ...filter, isNegative: !filter.isNegative }
          : filter,
      ),
    );
  };

  const requestPaint = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const formatEdgeLabel = useCallback((edge: SimulationEdge) => {
    if (edge.type === 'aggregated' || edge.type === 'membership') {
      return { before: '', emphasis: '', after: '' };
    }
    const youLabel = tPeople('you');
    const sourceName = edge.sourceLabel ?? '';
    const targetName = edge.targetLabel ?? '';
    const typeStr = capitalizeType
      ? edge.type.charAt(0).toUpperCase() + edge.type.slice(1)
      : edge.type.toLowerCase();
    let full: string;
    if (sourceName === youLabel || sourceName === 'You') {
      full = tPeople('graphEdgeLabelFromYou', { type: typeStr });
    } else if (targetName === youLabel || targetName === 'You') {
      full = tPeople('graphEdgeLabelToYou', { type: typeStr });
    } else {
      full = tPeople('graphEdgeLabel', { type: typeStr });
    }
    const idx = full.toLowerCase().indexOf(typeStr.toLowerCase());
    if (idx < 0) return { before: full, emphasis: '', after: '' };
    return {
      before: full.substring(0, idx),
      emphasis: full.substring(idx, idx + typeStr.length),
      after: full.substring(idx + typeStr.length),
    };
  }, [tPeople, capitalizeType]);

  // Step 1: Paint loop
  const runPaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Keep backing store in sync with CSS size and DPR.
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const wantW = Math.floor(rect.width * dpr);
    const wantH = Math.floor(rect.height * dpr);
    if (canvas.width !== wantW || canvas.height !== wantH) {
      canvas.width = wantW;
      canvas.height = wantH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const transform = transformRef.current;
    const lod = getLODTier(transform.k);
    const isDark = document.documentElement.classList.contains('dark');

    // Request photos for nodes that will render at full LOD and are in viewport.
    if (lod !== 'dots') {
      const padPx = 64;
      for (const node of nodesRef.current) {
        if (node.kind !== 'person') continue;
        if (!node.photo) continue;
        if (node.x === undefined || node.y === undefined) continue;
        const screenX = node.x * transform.k + transform.x;
        const screenY = node.y * transform.k + transform.y;
        if (
          screenX < -padPx || screenX > rect.width + padPx ||
          screenY < -padPx || screenY > rect.height + padPx
        ) continue;
        const src = node.id.startsWith('user-')
          ? '/api/photos/user'
          : `/api/photos/${node.id}`;
        loadPhoto(node.id, src, requestPaint);
      }
    }

    paintFrame(
      {
        ctx,
        transform,
        width: rect.width,
        height: rect.height,
        lod,
        isDark,
        isMobile,
        hoveredNodeId: touchSelectedNodeIdRef.current ?? hoveredNodeIdRef.current ?? focusedNodeIdRef.current,
        focusedNodeId: focusedNodeIdRef.current,
        getPhoto: getCachedPhoto,
        formatEdgeLabel,
      },
      nodesRef.current,
      edgesRef.current,
    );
  }, [isMobile, requestPaint, formatEdgeLabel]);

  useEffect(() => {
    const tick = () => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        runPaint();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [runPaint]);

  // Step 2: Simulation builder
  const buildSimulation = useCallback((nodes: SimulationNode[], edges: SimulationEdge[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mobileLinkDistance = isMobile ? 110 : linkDistance;
    const mobileChargeStrength = isMobile ? -250 : chargeStrength;
    const personCollisionR = isMobile ? 38 : 52;

    // Visible-radius-aware collision so bubbles don't overlap "you" or each other.
    const collisionForNode = (d: SimulationNode): number => {
      if (d.kind === 'bubble') return (isMobile ? 12 : 14) + (isMobile ? 18 : 28);
      return personCollisionR;
    };

    const membershipLinkDistance = isMobile ? 22 : 32;
    const aggregatedLinkDistance = isMobile ? 150 : 220;

    // Custom force: each expanded ghost behaves like an "invisible big bubble".
    // Members get strongly pulled toward the ghost (orbiting close to it);
    // non-members get pushed out of the ghost's domain so the cluster reads
    // as a coherent island.
    const expandedClusterField = (() => {
      const tightenStrength = 0.35;
      const repelStrength = 0.5;
      const padding = isMobile ? 18 : 24;
      const memberRadius = isMobile ? 12 : 14;
      let attached: SimulationNode[] = [];
      const memberToGhostId = new Map<string, string>();

      const force = (alpha: number) => {
        // Build per-ghost domain (ghost position + radius + member set + protected ids)
        type Domain = { ghostId: string; x: number; y: number; r: number; protectedIds: Set<string> };
        const domains: Domain[] = [];
        for (const n of attached) {
          if (n.kind !== 'bubble' || !n.isExpanded || n.x === undefined) continue;
          const r = Math.sqrt(Math.max(n.memberCount, 1)) * memberRadius * 1.2 + padding;
          const protectedIds = new Set<string>([n.id, ...n.memberIds]);
          domains.push({ ghostId: n.id, x: n.x, y: n.y ?? 0, r, protectedIds });
        }
        if (domains.length === 0) return;

        // Tighten each expanded member toward its ghost
        for (const node of attached) {
          if (node.kind !== 'person') continue;
          const ghostId = memberToGhostId.get(node.id);
          if (!ghostId) continue;
          const dom = domains.find((d) => d.ghostId === ghostId);
          if (!dom || node.x === undefined) continue;
          const dx = dom.x - (node.x ?? 0);
          const dy = dom.y - (node.y ?? 0);
          node.vx = (node.vx ?? 0) + dx * tightenStrength * alpha;
          node.vy = (node.vy ?? 0) + dy * tightenStrength * alpha;
        }

        // Push non-members out of each domain
        for (const dom of domains) {
          for (const node of attached) {
            if (dom.protectedIds.has(node.id)) continue;
            if (node.x === undefined) continue;
            const dx = (node.x ?? 0) - dom.x;
            const dy = (node.y ?? 0) - dom.y;
            const d = Math.hypot(dx, dy);
            if (d > 0 && d < dom.r) {
              const push = ((dom.r - d) / dom.r) * repelStrength * alpha;
              node.vx = (node.vx ?? 0) + (dx / d) * push * dom.r;
              node.vy = (node.vy ?? 0) + (dy / d) * push * dom.r;
            }
          }
        }
      };

      force.initialize = (n: SimulationNode[]) => {
        attached = n;
        memberToGhostId.clear();
        for (const node of n) {
          if (node.kind === 'bubble' && node.isExpanded) {
            for (const memberId of node.memberIds) {
              memberToGhostId.set(memberId, node.id);
            }
          }
        }
      };

      return force;
    })();

    const sim = forceSimulation<SimulationNode>(nodes)
      .velocityDecay(0.6)
      .force('link', forceLink<SimulationNode, SimulationEdge>(edges)
        .id((d) => d.id)
        .distance((e) => {
          if (e.type === 'membership') return membershipLinkDistance;
          if (e.type === 'aggregated') return aggregatedLinkDistance;
          return mobileLinkDistance;
        })
        .strength((e) => e.type === 'membership' ? 0.4 : 1))
      .force('charge', forceManyBody().strength(mobileChargeStrength))
      .force('center', forceCenter(width / 2, height / 2))
      // Stronger pull for "you" anchors it at canvas-center under normal forces,
      // while still letting the user drag it around for fun.
      .force('centerX', forceX<SimulationNode>(width / 2).strength((d) => {
        if (d.kind === 'person' && d.isCenter) return 0.5;
        if (d.kind === 'bubble' && d.isExpanded) return 0;
        return 0.15;
      }))
      .force('centerY', forceY<SimulationNode>(height / 2).strength((d) => {
        if (d.kind === 'person' && d.isCenter) return 0.5;
        if (d.kind === 'bubble' && d.isExpanded) return 0;
        return 0.15;
      }))
      .force('collision', forceCollide<SimulationNode>().radius(collisionForNode))
      .force('expandedCluster', expandedClusterField);

    sim.on('tick', () => {
      quadtreeRef.current = buildQuadtree(nodes);
      requestPaint();
    });

    return sim;
  }, [isMobile, linkDistance, chargeStrength, requestPaint]);

  // Step 3: Composition helper — recomposes sim data from raw cache
  const recomposeAndBuildSim = useCallback((raw: { nodes: RawGraphPerson[]; edges: SimulationEdge[] }) => {
    // The API labels the signed-in user's node with a fixed English "You"
    // (user node ids are prefixed "user-"), so translate it here.
    const youLabel = tPeople('you');
    const incomingPeople = raw.nodes.map((n) =>
      n.id.startsWith('user-') ? { ...n, label: youLabel } : n,
    );

    // If no groups prop, we're not on the dashboard — skip bubble logic.
    const peopleInView = raw.nodes.filter((n) => !n.isCenter).length;
    const resolvedMode = groups ? resolveGraphMode(localGraphMode, peopleInView) : 'individuals';

    // Always expand any group that's currently in the include filter.
    const nextExpanded = new Set(expandedBubbles);
    if (resolvedMode === 'bubbles' && groups) {
      for (const id of includeGroupIds) {
        nextExpanded.add(id);
      }
    }

    // Drop expanded groups that no longer exist in the current data.
    if (resolvedMode === 'bubbles' && groups) {
      const presentGroups = new Set(groups.map((g) => g.id));
      presentGroups.add(UNGROUPED_SYNTHETIC_ID);
      for (const id of [...nextExpanded]) {
        if (!presentGroups.has(id)) nextExpanded.delete(id);
      }
    }
    if (nextExpanded.size !== expandedBubbles.size) {
      setExpandedBubbles(nextExpanded);
    }

    const incomingNodes = buildSimulationNodes({
      people: incomingPeople,
      groups: groups ?? [],
      mode: resolvedMode,
      expandedBubbles: nextExpanded,
      ungroupedLabel,
    });

    const rawEdges: SimulationEdge[] = raw.edges;
    const composedEdges = resolvedMode === 'bubbles'
      ? buildHubAndSpokeEdges({
          rawEdges,
          simNodes: incomingNodes,
          neutralEdgeColor: '#9ca3af',
        })
      : rawEdges;

    // d3-force's forceLink mutates each edge's source/target from string ids
    // to node-object references on the first sim build. If we reused those
    // mutated edges on a later rebuild, forceLink would keep the stale refs
    // (it skips resolution when source/target is already an object) — so the
    // new simulation would move new node objects while edges still drew
    // between the previous sim's node objects, leaving the visible
    // disconnect from #240. Clone edges with string ids each time.
    const incomingEdges: SimulationEdge[] = composedEdges.map((e) => ({
      ...e,
      source: edgeEndpointId(e.source),
      target: edgeEndpointId(e.target),
    }));

    const { nodes, edges } = diffSimulationData(nodesRef.current, incomingNodes, edgesRef.current, incomingEdges);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    if (compact) setCompactHeight(computeCompactHeight(nodes.length));

    simRef.current?.stop();
    const sim = buildSimulation(nodes, edges);
    if (sim) {
      // Keep "you" in the middle and the network in view while the layout
      // unfolds and once it has settled (also after a canvas resize), until the
      // user takes over the view.
      let ticks = 0;
      sim.on('tick.fit', () => {
        ticks += 1;
        if (ticks % AUTO_FIT_TICK_INTERVAL === 1 && !userMovedViewRef.current) fitView(false);
      });
      sim.on('end.fit', () => {
        if (!userMovedViewRef.current) fitView(true);
      });
      // A person picked through the search stays in the middle while the
      // layout settles, until the user moves the view
      sim.on('end.focus', () => {
        const focusedId = focusedNodeIdRef.current;
        if (focusedId && !focusMovedRef.current) applyFocus(focusedId, true);
      });
      sim.alpha(0.3).restart();
      simRef.current = sim;
      const pendingId = pendingFocusRef.current;
      if (pendingId) {
        pendingFocusRef.current = null;
        applyFocus(pendingId, false);
      }
    }
  }, [
    groups, localGraphMode, expandedBubbles,
    includeGroupIds, ungroupedLabel, buildSimulation, tPeople, fitView, applyFocus, compact,
  ]);

  // The fetch below finishes long after the render that started it, so it must
  // call the newest composer (mobile layout, current bubble state), not the one
  // from that render
  const recomposeRef = useRef(recomposeAndBuildSim);
  useEffect(() => {
    recomposeRef.current = recomposeAndBuildSim;
  });

  // Step 4: Data-fetch effect
  useEffect(() => {
    if (!canvasRef.current || !apiEndpoint) return;

    let cancelled = false;

    const fetchData = async () => {
      const url = new URL(apiEndpoint, window.location.origin);
      url.searchParams.set('groupMatchOperator', includeMode);
      if (includeGroupIds.length > 0) url.searchParams.set('includeGroupIds', includeGroupIds.join(','));
      if (excludeGroupIds.length > 0) url.searchParams.set('excludeGroupIds', excludeGroupIds.join(','));

      try {
        const response = await fetch(url.toString());
        if (!response.ok) return;
        const data = await response.json() as { nodes: RawGraphPerson[]; edges: SimulationEdge[] };

        if (cancelled) return;

        // On the dashboard, people without any connection are listed below the
        // network instead of drifting far away from it
        let graph = data;
        if (isDashboard) {
          const { connected, loose } = splitLoosePeople(data.nodes, data.edges);
          graph = { nodes: connected, edges: data.edges };
          setLoosePeople(loose);
        }
        setGraphPeople(graph.nodes);
        setGraphEdges(graph.edges);
        setNetworkSize(graph.nodes.filter((n) => !n.isCenter).length);

        rawCacheRef.current = graph;
        userMovedViewRef.current = false;
        recomposeRef.current(graph);
      } catch {
        // Offline or a broken response: the graph that is already shown stays
      }
    };

    fetchData();
    return () => { cancelled = true; };
    // The bubble state (expandedBubbles, localGraphMode) is handled by the
    // Step 5 effect from the cached raw data, so it needs no re-fetch.
  }, [apiEndpoint, refreshKey, reloadKey, includeMode, includeGroupIds, excludeGroupIds, isDashboard]);

  // Step 5: Recompose when bubble state changes (mode toggle, expand/collapse)
  useEffect(() => {
    const raw = rawCacheRef.current;
    if (!raw) return;
    recomposeAndBuildSim(raw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localGraphMode, expandedBubbles]);

  // Step 6: Zoom, click, hover, and drag handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const clientCoordsOf = (e: Event): [number, number] => {
      if ('touches' in e) {
        const te = e as TouchEvent;
        const t = te.touches[0] ?? te.changedTouches[0];
        return [t.clientX, t.clientY];
      }
      const me = e as MouseEvent;
      return [me.clientX, me.clientY];
    };

    const toGraphCoords = (clientX: number, clientY: number): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      const xPx = clientX - rect.left;
      const yPx = clientY - rect.top;
      const t = transformRef.current;
      return [(xPx - t.x) / t.k, (yPx - t.y) / t.k];
    };

    const nodeAt = (clientX: number, clientY: number): SimulationNode | undefined => {
      const tree = quadtreeRef.current;
      if (!tree) return undefined;
      const [gx, gy] = toGraphCoords(clientX, clientY);
      return findNodeAtPoint(tree, gx, gy, isMobile ? 28 : 22);
    };

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 3])
      .filter((event: Event) => {
        const me = event as MouseEvent;
        if (event.type === 'wheel') {
          // Without Ctrl/Cmd the wheel scrolls the page; show a short hint instead.
          if (shouldZoomOnWheel(me, isFullscreenRef.current)) return true;
          setZoomHintVisible(true);
          if (zoomHintTimerRef.current !== null) window.clearTimeout(zoomHintTimerRef.current);
          zoomHintTimerRef.current = window.setTimeout(() => setZoomHintVisible(false), 1800);
          return false;
        }
        if (me.ctrlKey || me.button) return false;
        if (event.type === 'mousedown' || event.type === 'touchstart') {
          const touch = 'touches' in event ? (event as TouchEvent).touches[0] : null;
          const cx = touch ? touch.clientX : me.clientX;
          const cy = touch ? touch.clientY : me.clientY;
          if (nodeAt(cx, cy)) return false;
        }
        return true;
      })
      .on('zoom', (event) => {
        // Only gestures carry a source event, fitView's own transforms do not.
        if (event.sourceEvent) {
          userMovedViewRef.current = true;
          focusMovedRef.current = true;
        }
        transformRef.current = event.transform;
        requestPaint();
      });
    zoomBehaviorRef.current = zoomBehavior;
    select(canvas).call(zoomBehavior);
    canvas.style.touchAction = canvasTouchAction(isFullscreenRef.current);

    const onMove = (event: MouseEvent) => {
      const node = nodeAt(event.clientX, event.clientY);
      const id = node?.id ?? null;
      if (hoveredNodeIdRef.current !== id) {
        hoveredNodeIdRef.current = id;
        canvas.style.cursor = id ? 'pointer' : 'default';
        requestPaint();
      }
    };

    const handleNodeActivate = (node: SimulationNode) => {
      if (node.kind === 'bubble') {
        // Collapse is instant.
        if (node.isExpanded) {
          setExpandedBubbles((prev) => {
            const next = new Set(prev);
            next.delete(node.groupId);
            return next;
          });
          return;
        }
        // Expand: push the bubble outward, pin it, reheat the sim so other
        // nodes redistribute, wait briefly, THEN trigger expansion so the
        // cluster lands in cleared space.
        if (node.x !== undefined && node.y !== undefined) {
          const center = nodesRef.current.find(
            (n): n is SimulationNode & { x: number; y: number } =>
              n.kind === 'person' && n.isCenter && n.x !== undefined && n.y !== undefined,
          );
          if (center) {
            const dx = node.x - center.x;
            const dy = node.y - center.y;
            const dist = Math.hypot(dx, dy) || 1;
            const memberRadius = isMobile ? 12 : 14;
            const padding = isMobile ? 18 : 24;
            const clusterRadius = Math.sqrt(Math.max(node.memberCount, 1)) * memberRadius * 1.2 + padding;
            const targetDist = (clusterRadius + (isMobile ? 130 : 180)) * 2;
            const finalDist = Math.max(dist, targetDist);
            const ratio = finalDist / dist;
            const targetX = center.x + dx * ratio;
            const targetY = center.y + dy * ratio;

            node.x = targetX;
            node.y = targetY;
            node.fx = targetX;
            node.fy = targetY;
            node.vx = 0;
            node.vy = 0;
            if (simRef.current) simRef.current.alpha(0.3).restart();

            const bubbleId = node.id;
            const groupId = node.groupId;

            setExpandedBubbles((prev) => {
              const next = new Set(prev);
              next.add(groupId);
              return next;
            });
            // Release the pin once the cluster has had time to settle. With
            // centerX/Y strength = 0 for expanded ghosts, it stays put.
            if (unpinTimeoutRef.current !== null) window.clearTimeout(unpinTimeoutRef.current);
            unpinTimeoutRef.current = window.setTimeout(() => {
              unpinTimeoutRef.current = null;
              const ghost = nodesRef.current.find((n) => n.id === bubbleId);
              if (ghost) {
                ghost.fx = null;
                ghost.fy = null;
              }
            }, 1500);
          }
        }
        return;
      }
      if (centerNodeNonClickable && node.isCenter) return;
      if (node.id.startsWith('user-')) router.push('/dashboard');
      else router.push(`/people/${node.id}`);
    };

    let dragStartX = 0;
    let dragStartY = 0;
    const CLICK_TRAVEL_PX = 4;
    const TOUCH_TRAVEL_PX = 12;

    const drag_ = drag<HTMLCanvasElement, unknown>()
      .container(canvas)
      .subject((event) => {
        const [cx, cy] = clientCoordsOf(event.sourceEvent);
        const node = nodeAt(cx, cy);
        return node ?? null;
      })
      .on('start', (event) => {
        const d = event.subject as SimulationNode | null;
        if (!d) return;
        dragStartX = event.x;
        dragStartY = event.y;
        isDraggingRef.current = true;
        userMovedViewRef.current = true;
        focusMovedRef.current = true;
        if (!event.active && simRef.current) simRef.current.alphaTarget(0.1).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event) => {
        const d = event.subject as SimulationNode | null;
        if (!d) return;
        const [cx, cy] = clientCoordsOf(event.sourceEvent);
        const [gx, gy] = toGraphCoords(cx, cy);
        d.fx = gx;
        d.fy = gy;
      })
      .on('end', (event) => {
        const d = event.subject as SimulationNode | null;
        if (!d) return;
        isDraggingRef.current = false;
        if (!event.active && simRef.current) simRef.current.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        const isTouch = event.sourceEvent?.type?.startsWith('touch');
        const threshold = isTouch ? TOUCH_TRAVEL_PX : CLICK_TRAVEL_PX;
        const traveled = Math.hypot(event.x - dragStartX, event.y - dragStartY);
        if (traveled >= threshold) return;

        if (isTouch) {
          if (touchSelectedNodeIdRef.current === d.id) {
            touchSelectedNodeIdRef.current = null;
            requestPaint();
            handleNodeActivate(d);
          } else {
            touchSelectedNodeIdRef.current = d.id;
            requestPaint();
          }
        } else {
          handleNodeActivate(d);
        }
      });

    select(canvas).call(drag_);

    const onTapEmpty = (event: TouchEvent) => {
      if (!touchSelectedNodeIdRef.current) return;
      const touch = event.changedTouches[0];
      if (touch && !nodeAt(touch.clientX, touch.clientY)) {
        touchSelectedNodeIdRef.current = null;
        requestPaint();
      }
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('touchend', onTapEmpty);

    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('touchend', onTapEmpty);
      select(canvas).on('.zoom', null);
      select(canvas).on('.drag', null);
      if (unpinTimeoutRef.current !== null) {
        window.clearTimeout(unpinTimeoutRef.current);
        unpinTimeoutRef.current = null;
      }
    };
  }, [centerNodeNonClickable, isMobile, requestPaint, router]);

  // On the dashboard the canvas ends at the bottom of the screen, so greeting,
  // key figures and network fit on one screen without scrolling
  useEffect(() => {
    if (compact || isFullscreen) return;
    const measure = () => {
      const wrap = canvasWrapRef.current;
      if (!wrap) return;
      const top = wrap.getBoundingClientRect().top + window.scrollY;
      setCanvasHeight(computeCanvasHeight({ viewportHeight: window.innerHeight, top }));
    };
    measure();
    window.addEventListener('resize', measure);
    // Anything above the canvas can change its height (filter pills wrapping,
    // an install hint appearing), which moves the canvas without a resize
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [compact, isFullscreen]);

  // Full screen: no page scrolling behind it, Escape closes the legend first
  // and then the full screen view
  useEffect(() => {
    if (!isFullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen && !legendOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (legendOpen) setLegendOpen(false);
      else setIsFullscreen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, legendOpen]);

  // The canvas changes size when entering or leaving full screen: frame the
  // network (or the person from the search) again once the layout has followed
  useEffect(() => {
    if (prevFullscreenRef.current === isFullscreen) return;
    prevFullscreenRef.current = isFullscreen;
    const timer = window.setTimeout(() => {
      const focusedId = focusedNodeIdRef.current;
      if (focusedId) {
        applyFocus(focusedId, true);
      } else {
        userMovedViewRef.current = false;
        fitView(true);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isFullscreen, applyFocus, fitView]);

  const legendData = useMemo(
    () => buildGraphLegend(graphPeople ?? [], graphEdges, groups ?? []),
    [graphPeople, graphEdges, groups],
  );

  const bubblesActive = resolveGraphMode(localGraphMode, networkSize) === 'bubbles';
  const noPeopleInView = isDashboard && graphPeople !== null
    && graphPeople.every((p) => p.isCenter);
  const filtersActive = selectedGroupFilters.length > 0;

  const openLooseList = () => {
    setLooseOpen(true);
    window.setTimeout(() => {
      looseSectionRef.current?.scrollIntoView({ block: 'nearest' });
    }, 0);
  };

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[60] flex flex-col bg-background p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]'
          : 'w-full h-full'
      }
      role={isFullscreen ? 'dialog' : undefined}
      aria-modal={isFullscreen ? true : undefined}
      aria-label={isFullscreen ? t('fullscreen.dialogLabel') : undefined}
    >
      {groups && (
        <div className="mb-3 space-y-2 shrink-0">
          <div className="flex items-stretch gap-3">
            <div className="shrink-0">
              <label className="flex h-full items-center text-sm placeholder-muted">
                <span
                  className="inline-flex h-full items-stretch rounded-md border border-border bg-surface-elevated p-0.5 focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setIncludeMode((prev) => (prev === 'or' ? 'and' : 'or'))
                    }
                    className="inline-flex h-full px-3 items-center justify-center whitespace-nowrap text-base font-normal rounded border border-transparent text-foreground transition-all hover:bg-surface focus:outline-none"
                    aria-label={t('matchMode.ariaLabel', {
                      title:
                        includeMode === 'or'
                          ? t('matchMode.anyTitle')
                          : t('matchMode.allTitle'),
                    })}
                    title={
                      includeMode === 'or'
                        ? t('matchMode.anyTitle')
                        : t('matchMode.allTitle')
                    }
                  >
                    {includeMode === 'or'
                      ? t('matchMode.any')
                      : t('matchMode.all')}
                  </button>
                </span>
              </label>
            </div>

            <div className="flex-1">
              <PillSelector<GroupFilterItem>
                selectedItems={selectedGroupFilters}
                availableItems={groups.map((g) => ({
                  id: g.id,
                  label: g.name,
                  color: g.color,
                  isNegative: false,
                }))}
                onAdd={(item) => {
                  setSelectedGroupFilters((prev) =>
                    prev.some((f) => f.id === item.id)
                      ? prev
                      : [...prev, { ...item, isNegative: false }],
                  );
                }}
                onRemove={(itemId) =>
                  setSelectedGroupFilters((prev) =>
                    prev.filter((f) => f.id !== itemId),
                  )
                }
                onClearAll={() => setSelectedGroupFilters([])}
                placeholder={t('filterPlaceholder')}
                emptyMessage={t('noGroupsFound')}
                showAllOnFocus={true}
                renderPill={(item, onRemove) => (
                  <GraphFilterGroupPill
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    color={item.color}
                    isNegative={item.isNegative}
                    onToggle={() => toggleFilterSign(item.id)}
                    onRemove={onRemove}
                    title={
                      item.isNegative
                        ? t('filterState.excluded')
                        : t('filterState.included')
                    }
                    ariaLabel={
                      item.isNegative
                        ? t('filterState.excludedWithLabel', {
                            label: item.label,
                          })
                        : t('filterState.includedWithLabel', {
                            label: item.label,
                          })
                    }
                  />
                )}
              />
            </div>
          </div>
        </div>
      )}
      <div
        ref={canvasWrapRef}
        className={`relative ${
          isFullscreen
            ? 'flex-1 min-h-0'
            : compact
              ? ''
              : 'h-[420px] sm:h-[500px] lg:h-[calc(100dvh-20rem)] lg:min-h-[480px]'
        }`}
        style={
          compact
            ? { height: compactHeight }
            : !isFullscreen && canvasHeight !== null ? { height: canvasHeight } : undefined
        }
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full bg-surface rounded-lg border border-border"
        />
        {zoomHintVisible && (
          <div
            role="status"
            className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[calc(100%-2rem)] rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-center text-xs text-muted shadow"
          >
            {t('zoomHint')}
          </div>
        )}
        {isDashboard && (
          <>
            <div className="absolute top-3 left-3 w-[calc(100%-5rem)] max-w-72">
              <GraphSearch
                people={graphPeople ?? []}
                onSelect={focusPerson}
                onClear={clearFocus}
              />
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="absolute top-3 right-3 inline-flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={isFullscreen ? t('fullscreen.exit') : t('fullscreen.enter')}
              title={isFullscreen ? t('fullscreen.exit') : t('fullscreen.enter')}
              aria-pressed={isFullscreen}
            >
              <svg
                className="w-5 h-5 text-primary dark:text-white"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                {isFullscreen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                )}
              </svg>
            </button>
            {noPeopleInView && (
              <div className="pointer-events-none absolute inset-x-4 top-[58%] flex justify-center">
                <div className="pointer-events-auto max-w-sm text-center rounded-lg bg-surface/90 px-4 py-3 text-sm text-muted">
                  {filtersActive ? (
                    <>
                      <p>{t('emptyFiltered')}</p>
                      <button
                        type="button"
                        onClick={() => setSelectedGroupFilters([])}
                        className="mt-2 inline-flex min-h-11 sm:min-h-0 items-center px-3 py-1.5 text-sm font-semibold text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                      >
                        {t('clearFilters')}
                      </button>
                    </>
                  ) : (
                    <p>{loosePeople.length > 0 ? t('noConnections') : t('emptyNetwork')}</p>
                  )}
                </div>
              </div>
            )}
            {legendOpen && (
              <div className="absolute bottom-20 left-4 w-64 max-w-[calc(100%-2rem)] max-h-[60%] overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-lg">
                <GraphLegend data={legendData} capitalizeLabels={capitalizeType} />
              </div>
            )}
            <div className="absolute bottom-4 left-4 flex gap-2">
              <button
                type="button"
                onClick={() => setLegendOpen((prev) => !prev)}
                className={`p-3 border rounded-lg transition-colors ${
                  legendOpen
                    ? 'bg-primary/20 border-primary/40 dark:bg-primary dark:border-primary'
                    : 'bg-surface border-border hover:bg-surface-elevated'
                }`}
                aria-label={t('legend.toggle')}
                title={t('legend.toggle')}
                aria-expanded={legendOpen}
              >
                <svg
                  className="w-5 h-5 text-primary dark:text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle cx="5" cy="6" r="1.5" />
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="5" cy="18" r="1.5" />
                  <path d="M10 6h10M10 12h10M10 18h10" />
                </svg>
              </button>
              {loosePeople.length > 0 && (
                <button
                  type="button"
                  onClick={openLooseList}
                  className="inline-flex items-center gap-2 px-3 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors text-sm text-foreground"
                  aria-label={t('loose.showList', { count: loosePeople.length })}
                  title={t('loose.showList', { count: loosePeople.length })}
                >
                  <svg
                    className="w-5 h-5 text-primary dark:text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" strokeDasharray="3 3" />
                  </svg>
                  <span className="font-semibold">{loosePeople.length}</span>
                </button>
              )}
            </div>
          </>
        )}
        <div className="absolute bottom-4 right-4 flex gap-2">
          {groups && (() => {
            const label = bubblesActive ? t('showIndividuals') : t('showAsGroups');
            return (
              <>
                <button
                  onClick={async () => {
                    const next: 'individuals' | 'bubbles' = bubblesActive ? 'individuals' : 'bubbles';
                    setLocalGraphMode(next);
                    try {
                      await fetch('/api/user/graph-display', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ graphMode: next }),
                      });
                    } catch {
                      // Silent fail — local state is source of truth until next page load.
                    }
                  }}
                  className={`p-3 border rounded-lg transition-colors ${
                    bubblesActive
                      ? 'bg-primary/20 border-primary/40 dark:bg-primary dark:border-primary'
                      : 'bg-surface border-border hover:bg-surface-elevated'
                  }`}
                  aria-label={label}
                  title={label}
                >
                  <svg className="w-5 h-5 text-primary dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="8" cy="8" r="4" strokeWidth="2"/>
                    <circle cx="16" cy="16" r="4" strokeWidth="2"/>
                  </svg>
                </button>
                {bubblesActive && expandedBubbles.size > 0 && (
                  <button
                    onClick={() => setExpandedBubbles(new Set())}
                    className="p-3 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors"
                    aria-label={t('collapseAllGroups')}
                    title={t('collapseAllGroups')}
                  >
                    <svg
                      className="w-5 h-5 text-primary dark:text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <polyline points="4 14 10 14 10 20" />
                      <polyline points="20 10 14 10 14 4" />
                      <line x1="14" y1="10" x2="21" y2="3" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  </button>
                )}
              </>
            );
          })()}
          <button
            onClick={() => fitView(true)}
            className="p-3 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors"
            aria-label={t('recenterGraph')}
            title={t('recenterGraph')}
          >
            <svg
              className="w-5 h-5 text-primary dark:text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <circle cx="12" cy="12" r="3" strokeWidth="2" fill="currentColor" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            </svg>
          </button>
        </div>
      </div>
      {isDashboard && (
        <div ref={looseSectionRef} className="shrink-0">
          <GraphLoosePeople
            people={loosePeople}
            open={looseOpen}
            onToggle={() => setLooseOpen((prev) => !prev)}
            filterActive={filtersActive}
            onAssigned={() => setReloadKey((k) => k + 1)}
          />
        </div>
      )}
    </div>
  );
}
