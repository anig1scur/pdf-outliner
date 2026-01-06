<script>
  import {tick} from 'svelte';
  import rough from 'roughjs';
  import GraphNode from './GraphNode.svelte';
  import {Sparkles, Loader2, RefreshCw, Maximize2, Minimize2, BrainCircuit, BookOpen} from 'lucide-svelte';
  import {CARD_W, CARD_H, getRandomPaperColor, computeHierarchicalLayout, getClosestPoints} from '../lib/graph-utils';
  export let items = [];
  export let apiConfig = {apiKey: ''};

  export let title = 'Untitled Book';

  export let onJumpToPage = (pageNumber) => {
    console.log('Jump to page:', pageNumber);
  };

  let graphData = {nodes: [], edges: []};
  let isLoading = false;
  let isFullscreen = false;
  let activeNodeId = null;

  let svg;
  let rc;

  let canvasWidth = 400;
  let canvasHeight = 400;

  let dragTarget = null;
  let initialMouse = {x: 0, y: 0};
  let initialNodePos = {x: 0, y: 0};
  let isDragging = false;
  let hasMovedDuringDrag = false;

  const ACTIVE_COLOR = '#60a5fa';

  const ROUGH_OPTS = {roughness: 2.5, bowing: 1.5, stroke: '#2d3436', strokeWidth: 1.5};
  const LINE_DIM = {roughness: 2, bowing: 1, stroke: '#e2e8f0', strokeWidth: 1};
  const LINE_ACTIVE = {roughness: 1, bowing: 1, stroke: ACTIVE_COLOR, strokeWidth: 2.5};

  async function handleGenerateGraph() {
    if (items.length === 0) return;
    isLoading = true;
    activeNodeId = null;

    const simplifiedItems = items.map((item) => ({
      id: item.id,
      title: item.title,
      page: item.to || null,
    }));

    try {
      const response = await fetch('/api/generate-board', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          tocItems: simplifiedItems,
          apiKey: apiConfig.apiKey,
        }),
      });

      if (!response.ok) throw new Error('API Failed');
      const data = await response.json();

      let nodes = data.nodes.map((n) => ({
        ...n,
        bgColor: n.isInferred ? '#f8fafc' : getRandomPaperColor(),
        x: 0,
        y: 0,
        page: n.page || null,
      }));
      let edges = data.edges || [];

      nodes = computeHierarchicalLayout(nodes, edges, canvasWidth);
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
    hasMovedDuringDrag = false;
    initialMouse = {x: e.clientX, y: e.clientY};
    initialNodePos = {x: node.x, y: node.y};
  }

  function handleWindowMouseMove(e) {
    if (!isDragging || !dragTarget) return;

    const dx = e.clientX - initialMouse.x;
    const dy = e.clientY - initialMouse.y;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      hasMovedDuringDrag = true;
    }

    dragTarget.x = initialNodePos.x + dx;
    dragTarget.y = initialNodePos.y + dy;

    graphData.nodes = graphData.nodes;

    requestAnimationFrame(drawWall);
  }

  function handleWindowMouseUp() {
    if (isDragging) {
      isDragging = false;
      dragTarget = null;
      updateCanvasSize();
    }
  }

  function handleNodeClick(node) {
    if (!hasMovedDuringDrag) {
      if (node.page && onJumpToPage) {
        onJumpToPage(node.page);
      }
    }
  }

  function drawWall() {
    if (!svg || !graphData.nodes.length) return;
    svg.innerHTML = '';
    rc = rough.svg(svg);

    const inactiveGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const activeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const pinGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    svg.appendChild(inactiveGroup);
    svg.appendChild(activeGroup);
    svg.appendChild(nodeGroup);
    svg.appendChild(pinGroup);

    const pinsToDraw = new Set();
    const nodesWithPins = new Set();

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

      // 1. 计算最近的连接点
      const {start, end} = getClosestPoints(src, tgt);
      const x1 = start.x;
      const y1 = start.y;
      const x2 = end.x;
      const y2 = end.y;

      // 2. 注册钉子位置
      pinsToDraw.add(`${x1},${y1}`);
      pinsToDraw.add(`${x2},${y2}`);
      nodesWithPins.add(src.id);
      nodesWithPins.add(tgt.id);

      // 3. 绘制自然下垂的曲线
      const distY = Math.abs(y2 - y1);
      const distX = Math.abs(x2 - x1);

      // 根据距离动态调整下垂幅度和摆动
      const gravity = 10 + distY * 0.15;
      const curveDir = idx % 2 === 0 ? 1 : -1;
      const swing = (10 + distX * 0.05) * curveDir;

      const midX = (x1 + x2) / 2 + swing;
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

      drawArrowHead(parentGroup, midX, midY, x2, y2, isActive ? ACTIVE_COLOR : '#e2e8f0');

      if (isActive) {
        const labelX = (x1 + x2) / 2 + swing / 2;
        const labelY = midY;
        drawEdgeLabel(parentGroup, edge.label, labelX, labelY);
      }
    });

    // 4. 绘制卡片
    graphData.nodes.forEach((node) => {
      const fillStyle = node.isInferred ? 'zigzag' : 'solid';
      const strokeStyle = node.isInferred ? '#94a3b8' : '#2d3436';

      // 如果当前节点没有连线，我们给它补一个默认顶部的钉子，防止它没钉子
      if (!nodesWithPins.has(node.id)) {
        pinsToDraw.add(`${node.x + CARD_W / 2},${node.y + 4}`);
      }

      nodeGroup.appendChild(
        rc.rectangle(node.x, node.y, CARD_W, CARD_H, {
          ...ROUGH_OPTS,
          fill: node.bgColor,
          fillStyle: fillStyle,
          stroke: strokeStyle,
          fillWeight: 1,
          strokeWidth: node.isInferred ? 1 : 1.5,
        })
      );
    });

    // 5. 统一绘制所有钉子 (去重后)
    pinsToDraw.forEach((coordStr) => {
      const [px, py] = coordStr.split(',').map(Number);
      drawPin(pinGroup, px, py);
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

    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', y + 5);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-family', 'serif');
    t.setAttribute('font-size', '14');
    t.setAttribute('fill', ACTIVE_COLOR);
    t.setAttribute('font-weight', 'bold');
    // translate(10px, 10px)
    t.setAttribute('transform', `translate(-15, -15)`);
    t.textContent = text;
    parent.appendChild(t);
  }

  function drawPin(parent, x, y) {
    parent.appendChild(rc.circle(x, y, 10, {fill: ACTIVE_COLOR, fillStyle: 'solid', stroke: 'none'}));
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
  class="bg-[#f0f0f0] flex flex-col overflow-hidden mx-auto
{isFullscreen ? ' fixed inset-0 z-[9999] w-screen h-screen rounded-none' : ' relative h-full rounded-xl '}"
  on:click={handleBgClick}
>
  <div class="absolute top-4 left-5 z-40 pointer-events-none select-none">
    <div class="flex gap-2 text-gray-500 opacity-80">
      <BookOpen size={32} />
      <span class="font-serif text-xl tracking-wide">{title}</span>
    </div>
  </div>

  {#if items.length > 0}
    <div class="absolute bottom-5 right-24 z-50 flex gap-2">
      <button
        on:click={handleGenerateGraph}
        disabled={isLoading || items.length === 0}
        class="flex items-center gap-2 text-white px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-400 to-cyan-400 disabled:opacity-50 transition-all active:scale-95 border-2 border-transparent font-['Patrick_Hand'] text-xl shadow-lg"
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
  {/if}

  <div class="flex-1 overflow-auto relative w-full h-full bg-grid-pattern cursor-grab active:cursor-grabbing">
    <div
      class="relative origin-top-left"
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
          <GraphNode
            {node}
            {activeNodeId}
            isDragTarget={dragTarget && dragTarget.id === node.id}
            on:mousedown={(e) => handleMouseDown(e, node)}
            on:click={() => handleNodeClick(node)}
          />
        {/each}
      </div>
    </div>
  </div>

  {#if items.length === 0}
    <div
      class="absolute inset-0 flex flex-col items-center justify-center text-gray-400 font-['Patrick_Hand'] opacity-50 pointer-events-none z-0"
    >
      <RefreshCw
        size={64}
        class="mb-6"
      />
      <span class="text-3xl">Generate ToC to start...</span>
    </div>
  {:else if !isLoading && items.length > 0 && graphData.nodes.length === 0}
    <div
      class="absolute max-w-[80%] mx-auto text-center inset-0 flex flex-col items-center justify-center text-gray-400 font-['Patrick_Hand'] opacity-50 pointer-events-none z-0"
    >
      <Sparkles
        size={64}
        class="mb-6"
      />
      <span class="text-3xl">Investigate to generate the knowledge board</span>
    </div>
  {:else if isLoading}
    <div
      class="absolute inset-0 max-w-[80%] mx-auto text-center flex flex-col items-center justify-center text-gray-400 font-['Patrick_Hand'] opacity-50 pointer-events-none z-0"
    >
      <span class="text-3xl animate-bounce">Generating the knowledge board...</span>
    </div>
  {/if}

  {#if isFullscreen}
    <div
      class="absolute bottom-4 left-4 font-['Patrick_Hand'] text-2xl text-gray-400 pointer-events-none z-30 opacity-60"
    >
      KNOWLEDGE BOARD
    </div>
  {/if}

  <button
    on:click={toggleFullscreen}
    class="absolute bottom-4 right-4 z-50 p-3 rounded-full transition-all hover:scale-110 active:scale-95 text-gray-400"
  >
    {#if isFullscreen}
      <Minimize2 size={30} />
    {:else}
      <Maximize2 size={30} />
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
