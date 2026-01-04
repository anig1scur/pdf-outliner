<script>
  import { onMount, tick } from 'svelte';
  import rough from 'roughjs';
  import { Sparkles, Loader2, RefreshCw, Maximize2, Minimize2 } from 'lucide-svelte';

  export let items = [];
  export let apiConfig = { provider: '', apiKey: '' };

  // --- State ---
  let graphData = { nodes: [], edges: [] };
  let isLoading = false;
  let isFullscreen = false;
  let svg;
  let rc;

  // 画布尺寸状态
  let canvasWidth = 400;
  let canvasHeight = 400;

  // 拖拽状态
  let dragTarget = null;      // 当前拖拽的节点对象
  let initialMouse = { x: 0, y: 0 }; // 鼠标按下时的坐标
  let initialNodePos = { x: 0, y: 0 }; // 节点按下时的初始坐标
  let isDragging = false;

  // --- Visual Config ---
  const CARD_W = 180;
  const CARD_H = 90;
  
  const CLUSTER_COLORS = {
    theory: '#fff9c4',      
    tool: '#e1f5fe',        
    advanced: '#f3e5f5',    
    application: '#e8f5e9', 
    default: '#ffffff'
  };

  const ROUGH_OPTS = { roughness: 2, bowing: 2, stroke: '#2d3436', strokeWidth: 1.5 };
  const LINE_OPTS = { roughness: 1.2, bowing: 6, stroke: '#d63031', strokeWidth: 2 }; 

  // --- Logic ---
  async function handleGenerateGraph() {
    if (items.length === 0) return;
    isLoading = true;
    try {
      const response = await fetch('/api/generate-board', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          tocItems: items, 
          apiKey: apiConfig.apiKey,
        }),
      });

      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      
      graphData = { nodes: data.nodes || [], edges: data.edges || [] };

      updateCanvasSize();

      await tick();
      drawWall(); 

    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  function updateCanvasSize() {
      if (graphData.nodes.length > 0) {
        const maxX = Math.max(...graphData.nodes.map(n => n.x)) + CARD_W + 100;
        const maxY = Math.max(...graphData.nodes.map(n => n.y)) + CARD_H + 100;
        canvasWidth = Math.max(maxX, isFullscreen ? window.innerWidth : 400);
        canvasHeight = Math.max(maxY, isFullscreen ? window.innerHeight : 400);
      }
  }

  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    tick().then(() => {
        updateCanvasSize();
        drawWall();
    });
  }

  // --- Dragging Logic (新增部分) ---

  function handleMouseDown(e, node) {
    // 阻止默认行为防止选中文字
    e.preventDefault(); 
    isDragging = true;
    dragTarget = node;
    
    // 记录初始状态
    initialMouse = { x: e.clientX, y: e.clientY };
    initialNodePos = { x: node.x, y: node.y };
  }

  function handleWindowMouseMove(e) {
    if (!isDragging || !dragTarget) return;

    // 计算位移
    const dx = e.clientX - initialMouse.x;
    const dy = e.clientY - initialMouse.y;

    // 更新节点坐标
    dragTarget.x = initialNodePos.x + dx;
    dragTarget.y = initialNodePos.y + dy;

    // 触发 Svelte 响应式更新 (让 HTML div 跟随)
    graphData = graphData;

    // 使用 requestAnimationFrame 优化重绘连线 (让 SVG 线条和背景跟随)
    requestAnimationFrame(() => {
        drawWall();
        // 拖拽时如果超出画布，可能需要动态扩展画布（可选，此处暂略保持简单）
    });
  }

  function handleWindowMouseUp() {
    if (isDragging) {
      isDragging = false;
      dragTarget = null;
      // 拖拽结束后，可能需要重新计算一下画布大小以防拖出去了
      updateCanvasSize();
    }
  }


  // --- Drawing Logic ---
  function drawWall() {
    if (!svg || !graphData.nodes.length) return;
    svg.innerHTML = ''; 
    rc = rough.svg(svg);

    // 1. 绘制连线 (底层)
    const edgeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(edgeGroup);

    graphData.edges.forEach((edge, idx) => {
       const src = graphData.nodes.find(n => n.id === edge.source);
       const tgt = graphData.nodes.find(n => n.id === edge.target);
       if (!src || !tgt) return;
       
       // 坐标中心点
       const x1 = src.x + CARD_W / 2; const y1 = src.y + CARD_H / 2;
       const x2 = tgt.x + CARD_W / 2; const y2 = tgt.y + CARD_H / 2;
       
       const curveDir = (idx % 2 === 0) ? 1 : -1; 
       const curveIntensity = 20 + (idx % 3) * 10;
       const midX = (x1 + x2) / 2 + (curveIntensity * curveDir * 0.5);
       const midY = (y1 + y2) / 2 + (curveIntensity * curveDir);

       if (edge.type === 'CONTRASTS') {
          edgeGroup.appendChild(rc.curve([[x1, y1], [midX + 30, midY - 30], [midX - 30, midY + 30], [x2, y2]], { ...LINE_OPTS, stroke: '#2980b9', roughness: 3, bowing: 2 })); 
       } else {
          edgeGroup.appendChild(rc.curve([[x1, y1], [midX, midY], [x2, y2]], LINE_OPTS));
       }
       
       const labelX = 0.25 * x1 + 0.5 * midX + 0.25 * x2;
       const labelY = 0.25 * y1 + 0.5 * midY + 0.25 * y2;
       drawLabel(edgeGroup, edge.label, labelX, labelY);
    });

    // 2. 绘制节点背景 (Rough.js 风格框)
    // 注意：这里只画 SVG 视觉层，真正的文字内容在 HTML div 层
    const nodeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(nodeGroup);

    graphData.nodes.forEach(node => {
      const bgColor = CLUSTER_COLORS[node.cluster] || CLUSTER_COLORS.default;
      // 绘制背景框
      nodeGroup.appendChild(rc.rectangle(node.x, node.y, CARD_W, CARD_H, { ...ROUGH_OPTS, fill: bgColor, fillStyle: 'solid' }));
      // 绘制大头针
      drawPin(nodeGroup, node.x + CARD_W/2, node.y + 3);
    });
  }
  
  // Helpers
  function drawLabel(parent, text, x, y) { 
      if (!text) return;
      parent.appendChild(rc.rectangle(x - 30, y - 10, 60, 20, { fill: '#fff', fillStyle: 'solid', stroke: 'none' }));
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", x); t.setAttribute("y", y + 4); t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-family", "'Patrick Hand', cursive"); t.setAttribute("font-size", "11"); t.setAttribute("fill", "#636e72");
      t.textContent = text;
      parent.appendChild(t);
  }
  function drawPin(parent, x, y) { 
     parent.appendChild(rc.line(x - 12, y, x + 12, y, { stroke: 'rgba(0,0,0,0.15)', strokeWidth: 10, roughness: 0 }));
  }
</script>

<svelte:window on:mousemove={handleWindowMouseMove} on:mouseup={handleWindowMouseUp} />

<svelte:head>
  <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet">
</svelte:head>

<div 
  class="bg-[#f8f9fa] border-2 border-black shadow-[6px_6px_0px_#000] transition-all duration-300 flex flex-col
  {isFullscreen ? 'fixed inset-0 z-[100] w-screen h-screen rounded-none' : 'relative w-full h-[400px] rounded-xl'}"
>
  
  <div class="absolute top-4 right-4 z-50 flex gap-2">
    <button 
      on:click={handleGenerateGraph}
      disabled={isLoading || items.length === 0}
      class="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-400 disabled:opacity-50 transition-all active:scale-95 border-2 border-transparent hover:border-white font-['Patrick_Hand'] text-lg shadow-lg"
    >
      {#if isLoading}
        <Loader2 class="animate-spin" size={18} />
        <span>Analyzing...</span>
      {:else}
        <Sparkles size={18} />
        <span>Generate</span>
      {/if}
    </button>
  </div>

  <div class="flex-1 overflow-auto relative w-full h-full bg-grid-pattern {isDragging ? 'cursor-grabbing select-none' : ''}">
    
    <div 
      class="relative"
      style="width: {canvasWidth}px; height: {canvasHeight}px; min-width: 100%; min-height: 100%;"
    >
        <svg bind:this={svg} width={canvasWidth} height={canvasHeight} class="absolute inset-0 pointer-events-none z-10"></svg>

        <div class="absolute inset-0 z-20 pointer-events-none">
            {#each graphData.nodes as node (node.id)}
            <div 
                class="absolute pointer-events-auto transition-transform duration-0 cursor-grab active:cursor-grabbing hover:scale-[1.02]"
                style="
                    left: {node.x}px; 
                    top: {node.y}px; 
                    width: {CARD_W}px; 
                    height: {CARD_H}px;
                    z-index: {dragTarget === node ? 50 : 'auto'};
                "
                on:mousedown={(e) => handleMouseDown(e, node)}
            >
                <div class="p-4 h-full flex flex-col justify-center text-center select-none">
                    <div class="font-['Patrick_Hand'] text-lg leading-5 font-bold text-gray-400 break-words line-clamp-3">
                    {node.title}
                    </div>
                    {#if node.page}
                    <div class="absolute bottom-2 right-3 text-xs font-mono text-gray-400">
                      p.{node.page}
                    </div>
                  {/if}
                </div>
            </div>
            {/each}
        </div>
    </div>
  </div>

  {#if graphData.nodes.length === 0 && !isLoading}
    <div class="absolute inset-0 flex flex-col items-center justify-center text-gray-400 font-['Patrick_Hand'] opacity-50 z-0 pointer-events-none">
      <RefreshCw size={48} class="mb-4" />
      <span class="text-2xl">Ready to map out the connections...</span>
    </div>
  {/if}

  <div class="absolute bottom-4 left-4 font-['Patrick_Hand'] text-xl text-gray-400 pointer-events-none z-30 opacity-70">
    Detective Board
  </div>

  <button 
    on:click={toggleFullscreen}
    class="absolute bottom-4 right-4 z-50 p-2 bg-white border-2 border-black rounded-lg shadow-md hover:bg-gray-100 transition-all hover:scale-110 active:scale-95"
    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
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
    background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
    background-size: 20px 20px;
  }
</style>