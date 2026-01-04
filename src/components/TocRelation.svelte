<script>
  import {onMount, tick} from 'svelte';
  import rough from 'roughjs';
  import {Sparkles, Loader2, RefreshCw, Maximize2, Minimize2, BrainCircuit} from 'lucide-svelte';

  export let items = [];
  export let apiConfig = {apiKey: ''};

  let graphData = {nodes: [], edges: []};
  let isLoading = false;
  let isFullscreen = false;
  let activeNodeId = null;

  // DOM References
  let svg;
  let rc;

  // Canvas State
  let canvasWidth = 400;
  let canvasHeight = 400;

  // Dragging State
  let dragTarget = null;
  let initialMouse = {x: 0, y: 0};
  let initialNodePos = {x: 0, y: 0};
  let isDragging = false;

  // --- Visual Config (更宽松的布局) ---
  const CARD_W = 200;
  const CARD_H = 120;
  const GAP_X = 320;
  const GAP_Y = 280;

  const ROUGH_OPTS = {roughness: 2.5, bowing: 1.5, stroke: '#2d3436', strokeWidth: 1.5};

  const LINE_DIM = {roughness: 2, bowing: 1, stroke: '#e2e8f0', strokeWidth: 1};
  const LINE_ACTIVE = {roughness: 1, bowing: 1, stroke: '#ef4444', strokeWidth: 2.5};

  const getRandomPaperColor = () => {
    const papers = ['#ffffff', '#fdfbf7', '#fcfcfc'];
    return papers[Math.floor(Math.random() * papers.length)];
  };

  async function handleGenerateGraph() {
    if (items.length === 0) return;
    isLoading = true;
    activeNodeId = null;
    try {
      const response = await fetch('/api/generate-board', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({tocItems: items, apiKey: apiConfig.apiKey}),
      });

      if (!response.ok) throw new Error('API Failed');
      const data = await response.json();

      let nodes = data.nodes.map((n) => ({
        ...n,
        bgColor: n.isInferred ? '#f8fafc' : getRandomPaperColor(),
        x: 0,
        y: 0,
      }));
      let edges = data.edges || [];

      nodes = computeHierarchicalLayout(nodes, edges);
      graphData = {nodes, edges};

      await tick();
      centerContent();
      updateCanvasSize();
      drawWall();
    } catch (e) {
      console.error(e);
      alert('Failed to generate board.');
    } finally {
      isLoading = false;
    }
  }

  function computeHierarchicalLayout(nodes, edges) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const adj = new Map();
    const revAdj = new Map();

    nodes.forEach((n) => {
      adj.set(n.id, []);
      revAdj.set(n.id, []);
    });
    edges.forEach((e) => {
      if (adj.has(e.source)) adj.get(e.source).push(e.target);
      if (revAdj.has(e.target)) revAdj.get(e.target).push(e.source);
    });

    const asapLevels = new Map();
    nodes.forEach((n) => asapLevels.set(n.id, 0));

    for (let i = 0; i < 10; i++) {
      let changed = false;
      edges.forEach((edge) => {
        const srcLvl = asapLevels.get(edge.source) || 0;
        const tgtLvl = asapLevels.get(edge.target) || 0;
        if (srcLvl >= tgtLvl) {
          asapLevels.set(edge.target, srcLvl + 1);
          changed = true;
        }
      });
      if (!changed) break;
    }

    const finalLevels = new Map();
    nodes.forEach((n) => {
      if ((adj.get(n.id) || []).length === 0) {
        finalLevels.set(n.id, asapLevels.get(n.id));
      } else {
        finalLevels.set(n.id, -1);
      }
    });

    for (let i = 0; i < 10; i++) {
      let changed = false;
      nodes.forEach((n) => {
        const targets = adj.get(n.id);
        if (targets.length > 0) {
          let minChildLevel = Infinity;
          targets.forEach((tId) => {
            const childLvl = asapLevels.get(tId);
            if (childLvl < minChildLevel) minChildLevel = childLvl;
          });
          const anchorLevel = minChildLevel - 1;
          const baseLevel = asapLevels.get(n.id);
          const bestLevel = Math.max(baseLevel, anchorLevel);

          if (finalLevels.get(n.id) !== bestLevel) {
            finalLevels.set(n.id, bestLevel);
            asapLevels.set(n.id, bestLevel);
            changed = true;
          }
        }
      });
      if (!changed) break;
    }

    const levelGroups = [];
    nodes.forEach((n) => {
      let lvl = finalLevels.get(n.id);
      if (lvl === -1 || lvl === undefined) lvl = asapLevels.get(n.id);
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(n);
    });

    const compactGroups = levelGroups.filter((g) => g && g.length > 0);

    compactGroups.forEach((group, lvlIndex) => {
      const rowWidth = group.length * GAP_X;
      const startX = canvasWidth / 2 - rowWidth / 2;

      group.forEach((node, colIndex) => {
        node.x = startX + colIndex * GAP_X + (Math.random() - 0.5) * 40;
        node.y = 100 + lvlIndex * GAP_Y;
      });
    });

    return nodes;
  }

  function updateCanvasSize() {
    if (graphData.nodes.length > 0) {
      const minX = Math.min(...graphData.nodes.map((n) => n.x));
      const maxX = Math.max(...graphData.nodes.map((n) => n.x));
      const maxY = Math.max(...graphData.nodes.map((n) => n.y));

      if (minX < 50) {
        const offsetX = 50 - minX;
        graphData.nodes.forEach((n) => (n.x += offsetX));
      }

      canvasWidth = Math.max(maxX + CARD_W + 200, isFullscreen ? window.innerWidth : 400);
      canvasHeight = Math.max(maxY + CARD_H + 200, isFullscreen ? window.innerHeight : 400);
    }
  }

  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    tick().then(() => {
      centerContent();
      updateCanvasSize();
      drawWall();
    });
  }

  function handleBgClick(e) {
    if (e.target === e.currentTarget) {
      activeNodeId = null;
      drawWall();
    }
  }

  function handleMouseDown(e, node) {
    if (e.target.closest('button')) return;

    activeNodeId = node.id;
    drawWall();

    isDragging = true;
    dragTarget = node;
    initialMouse = {x: e.clientX, y: e.clientY};
    initialNodePos = {x: node.x, y: node.y};
  }

  function handleWindowMouseMove(e) {
    if (!isDragging || !dragTarget) return;
    const dx = e.clientX - initialMouse.x;
    const dy = e.clientY - initialMouse.y;
    dragTarget.x = initialNodePos.x + dx;
    dragTarget.y = initialNodePos.y + dy;

    requestAnimationFrame(drawWall);
  }

  function handleWindowMouseUp() {
    if (isDragging) {
      isDragging = false;
      dragTarget = null;
      updateCanvasSize();
    }
  }

  function drawWall() {
    if (!svg || !graphData.nodes.length) return;
    svg.innerHTML = '';
    rc = rough.svg(svg);

    const inactiveGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const activeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    svg.appendChild(inactiveGroup);
    svg.appendChild(activeGroup);

    const edgesToDraw = graphData.edges
      .map((edge, idx) => {
        const src = graphData.nodes.find((n) => n.id === edge.source);
        const tgt = graphData.nodes.find((n) => n.id === edge.target);
        if (!src || !tgt) return null;

        const isActive = activeNodeId && (edge.source === activeNodeId || edge.target === activeNodeId);

        return {edge, src, tgt, idx, isActive};
      })
      .filter(Boolean);

    edgesToDraw.forEach(({edge, src, tgt, idx, isActive}) => {
      const parentGroup = isActive ? activeGroup : inactiveGroup;
      const options = isActive ? LINE_ACTIVE : LINE_DIM;

      const x1 = src.x + CARD_W / 2;
      const y1 = src.y + CARD_H / 2;
      const x2 = tgt.x + CARD_W / 2;
      const y2 = tgt.y + 5;

      const distY = Math.abs(y2 - y1);
      const gravity = distY * 0.15;
      const curveDir = idx % 2 === 0 ? 1 : -1;
      const swing = (40 + distY * 0.1) * curveDir;

      const midX = (x1 + x2) / 2 + swing + (Math.random() * 20 - 10);
      const midY = (y1 + y2) / 2 + gravity;

      parentGroup.appendChild(
        rc.curve(
          [
            [x1, y1],
            [midX, midY],
            [x2, y2],
          ],
          options
        )
      );

      drawArrowHead(parentGroup, midX, midY, x2, y2, isActive ? '#ef4444' : '#e2e8f0');

      if (isActive) {
        const labelX = (x1 + x2) / 2 + swing / 2;
        const labelY = midY;
        drawEdgeLabel(parentGroup, edge.label, labelX, labelY);
      }
    });

    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(nodeGroup);

    graphData.nodes.forEach((node) => {
      const fillStyle = node.isInferred ? 'zigzag' : 'solid';
      const strokeStyle = node.isInferred ? '#94a3b8' : '#2d3436';

      nodeGroup.appendChild(
        rc.rectangle(node.x, node.y, CARD_W, CARD_H, {
          ...ROUGH_OPTS,
          fill: node.bgColor,
          fillStyle: fillStyle,
          stroke: strokeStyle,
          fillWeight: 1,
        })
      );

      drawPin(nodeGroup, node.x + CARD_W / 2, node.y + 4);
    });
  }

  function centerContent() {
    if (graphData.nodes.length === 0) return;

    const minX = Math.min(...graphData.nodes.map((n) => n.x));
    const maxX = Math.max(...graphData.nodes.map((n) => n.x));
    const graphWidth = maxX - minX + CARD_W;

    const containerWidth = isFullscreen ? window.innerWidth : 400;

    const targetMinX = Math.max(50, (containerWidth - graphWidth) / 2);

    const offsetX = targetMinX - minX;

    graphData.nodes.forEach((n) => (n.x += offsetX));

    graphData.nodes = graphData.nodes;
  }
  function drawArrowHead(parent, prevX, prevY, tipX, tipY, color) {
    const angle = Math.atan2(tipY - prevY, tipX - prevX);
    const arrowLen = 14;
    const arrowWid = 0.5;
    const xA = tipX - arrowLen * Math.cos(angle - arrowWid);
    const yA = tipY - arrowLen * Math.sin(angle - arrowWid);
    const xB = tipX - arrowLen * Math.cos(angle + arrowWid);
    const yB = tipY - arrowLen * Math.sin(angle + arrowWid);

    parent.appendChild(
      rc.polygon(
        [
          [tipX, tipY],
          [xA, yA],
          [xB, yB],
        ],
        {
          fill: color,
          stroke: 'none',
          fillStyle: 'solid',
          roughness: 0.5,
        }
      )
    );
  }

  function drawEdgeLabel(parent, text, x, y) {
    if (!text) return;
    parent.appendChild(rc.rectangle(x - 30, y - 12, 60, 24, {fill: '#fff', fillStyle: 'solid', stroke: 'none'}));

    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', y + 5);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-family', "'Patrick Hand', cursive");
    t.setAttribute('font-size', '14');
    t.setAttribute('fill', '#ef4444');
    t.setAttribute('font-weight', 'bold');
    t.textContent = text;
    parent.appendChild(t);
  }

  function drawPin(parent, x, y) {
    parent.appendChild(rc.circle(x, y, 12, {fill: '#ef4444', fillStyle: 'solid', stroke: 'none'}));
  }
</script>

<svelte:window
  on:mousemove={handleWindowMouseMove}
  on:mouseup={handleWindowMouseUp}
/>

<svelte:head>
  <link
    href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div
  class="bg-[#f0f0f0] flex flex-col overflow-hidden transition-all duration-300
  {isFullscreen
    ? 'fixed inset-0 z-[9999] w-screen h-screen rounded-none'
    : 'relative w-full h-[400px] rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]'}"
  on:click={handleBgClick}
>
  <div class="absolute top-4 right-4 z-50 flex gap-2">
    <button
      on:click={handleGenerateGraph}
      disabled={isLoading || items.length === 0}
      class="flex items-center gap-2 bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-400 disabled:opacity-50 transition-all active:scale-95 border-2 border-transparent font-['Patrick_Hand'] text-xl shadow-lg"
    >
      {#if isLoading}
        <Loader2
          class="animate-spin"
          size={20}
        />
        <span>Connecting...</span>
      {:else}
        <Sparkles size={20} />
        <span>Investigate</span>
      {/if}
    </button>
  </div>

  <div class="flex-1 overflow-auto relative w-full h-full bg-grid-pattern cursor-grab active:cursor-grabbing">
    <div
      class="relative origin-top-left transition-[width,height] duration-200"
      style="width: {canvasWidth}px; height: {canvasHeight}px;"
    >
      <svg
        bind:this={svg}
        width={canvasWidth}
        height={canvasHeight}
        class="absolute inset-0 pointer-events-none z-10"
      ></svg>

      <div class="absolute inset-0 z-20 pointer-events-none">
        {#each graphData.nodes as node (node.id)}
          <div
            class="absolute pointer-events-auto select-none group flex flex-col items-center justify-center text-center p-3 transition-colors duration-200
                {activeNodeId === node.id ? 'ring-4 ring-red-400 z-50 scale-105' : 'z-20 hover:scale-105'}
                "
            style="
                    left: {node.x}px; 
                    top: {node.y}px; 
                    width: {CARD_W}px; 
                    height: {CARD_H}px;
                "
            on:mousedown={(e) => handleMouseDown(e, node)}
          >
            {#if node.isInferred}
              <div
                class="absolute top-2 left-2 flex items-center gap-1 text-[9px] text-slate-400 uppercase font-bold tracking-widest bg-slate-100 px-1 rounded"
              >
                <BrainCircuit size={10} />
                <span>AI</span>
              </div>
            {/if}

            <div
              class="font-['Patrick_Hand'] text-lg leading-5 font-bold text-gray-400 break-words line-clamp-3 w-full"
            >
              {node.title}
            </div>

            {#if node.page}
              <div class="absolute bottom-2 right-2 text-xs font-mono text-gray-400">
                p.{node.page}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  {#if graphData.nodes.length === 0 && !isLoading}
    <div
      class="absolute inset-0 flex flex-col items-center justify-center text-gray-400 font-['Patrick_Hand'] opacity-50 pointer-events-none z-0"
    >
      <RefreshCw
        size={64}
        class="mb-6"
      />
      <span class="text-3xl">Upload ToC to start...</span>
    </div>
  {/if}

  <div
    class="absolute bottom-4 left-4 font-['Patrick_Hand'] text-2xl text-gray-400 pointer-events-none z-30 opacity-60"
  >
    CONNECTION BOARD
  </div>

  <button
    on:click={toggleFullscreen}
    class="absolute bottom-4 right-4 z-50 p-3 bg-white border-2 border-black rounded-full shadow-md hover:bg-yellow-100 transition-all hover:scale-110 active:scale-95"
  >
    {#if isFullscreen}
      <Minimize2 size={24} />
    {:else}
      <Maximize2 size={24} />
    {/if}
  </button>
</div>

<style>
  .bg-grid-pattern {
    background-color: #fdfbf7;
    background-image: linear-gradient(#e5e7eb 1px, transparent 1px),
      linear-gradient(90deg, #e5e7eb 1px, transparent 1px);
    background-size: 20px 20px;
  }
</style>
