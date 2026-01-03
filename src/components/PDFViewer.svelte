<script lang="ts">
  import {createEventDispatcher, tick} from 'svelte';
  import {ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, ListOrdered} from 'lucide-svelte';
  import {t} from 'svelte-i18n';

  import {pdfService} from '../stores';
  import {type PDFService, type PDFState} from '../lib/pdf-service';
  import type {RenderTask} from 'pdfjs-dist';

  export let pdfState: PDFState;
  export let mode: 'single' | 'grid' = 'single';
  export let tocStartPage: number;
  export let tocEndPage: number;

  export let jumpToTocPage: (() => Promise<void>) | undefined = undefined;
  export let addPhysicalTocPage: boolean = false;
  export let hasPreview: boolean = false;

  const dispatch = createEventDispatcher();

  let gridPages: {pageNum: number; canvasId: string}[] = [];
  let pdfServiceInstance: PDFService | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let scrollContainer: HTMLElement;

  let canvasesToObserve: HTMLCanvasElement[] = [];

  let isSelecting = false;
  let selectionStartPage = 0;

  let pressTimer: number | null = null;
  let loadedFilename: string = '';

  let autoScrollSpeed = 0;
  let autoScrollFrameId: number | null = null;

  let currentRenderTask: RenderTask | null = null;
  let lastRenderedPage = 0;
  let lastRenderedScale = 0;

  pdfService.subscribe((val) => (pdfServiceInstance = val));

  $: ({filename, currentPage, scale, totalPages, instance} = pdfState);

  $: if (instance && filename && filename !== loadedFilename) {
    loadedFilename = filename;
    tick().then(() => {
      dispatch('fileloaded', {
        message: $t('msg.pdf_loaded'),
        type: 'success',
      });
    });
  }

  async function renderCurrentPage() {
    if (!instance || !currentPage || !scale) return;
    if (lastRenderedPage === currentPage && lastRenderedScale === scale) {
      return;
    }

    if (currentRenderTask) {
      try {
        currentRenderTask.cancel();
      } catch (e) {
      }
      currentRenderTask = null;
    }

    await tick();
    const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
    if (!canvas || !instance) return;

    try {
      const page = await instance.getPage(currentPage);

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({scale: scale});

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);

      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const canvasContext = canvas.getContext('2d');
      if (!canvasContext) return;

      canvasContext.scale(dpr, dpr);

      const renderContext = {
        canvasContext,
        viewport,
      };

      currentRenderTask = page.render(renderContext);

      await currentRenderTask?.promise;

      lastRenderedPage = currentPage;
      lastRenderedScale = scale;
      currentRenderTask = null;
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') {
        console.error('Rendering error:', e);
      }
      currentRenderTask = null;
    }
  }

  $: if (mode === 'single' && instance && currentPage && scale) {
    renderCurrentPage();
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      pdfState.currentPage += 1;
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      pdfState.currentPage -= 1;
    }
  };

  const zoomIn = () => {
    pdfState.scale = Math.min(scale + 0.15, 2.0);
  };

  const zoomOut = () => {
    pdfState.scale = Math.max(scale - 0.15, 0.5);
  };

  const resetZoom = () => {
    pdfState.scale = 1.0;
  };

  $: if (instance && mode === 'grid') {
    gridPages = Array.from({length: totalPages}, (_, i) => ({
      pageNum: i + 1,
      canvasId: `thumb-canvas-${i + 1}`,
    }));
  }

  function scrollLoop() {
    if (autoScrollSpeed === 0 || !scrollContainer) {
      autoScrollFrameId = null;
      return;
    }
    scrollContainer.scrollTop += autoScrollSpeed;
    autoScrollFrameId = requestAnimationFrame(scrollLoop);
  }

  function stopAutoScroll() {
    autoScrollSpeed = 0;
    if (autoScrollFrameId) {
      cancelAnimationFrame(autoScrollFrameId);
      autoScrollFrameId = null;
    }
  }

  function checkAutoScroll(clientY: number) {
    if (!isSelecting || !scrollContainer) {
      stopAutoScroll();
      return;
    }
    const rect = scrollContainer.getBoundingClientRect();
    const hotZoneSize = 80;

    if (clientY < rect.top + hotZoneSize) {
      autoScrollSpeed = -10;
      if (!autoScrollFrameId) autoScrollFrameId = requestAnimationFrame(scrollLoop);
    } else if (clientY > rect.bottom - hotZoneSize) {
      autoScrollSpeed = 10;
      if (!autoScrollFrameId) autoScrollFrameId = requestAnimationFrame(scrollLoop);
    } else {
      stopAutoScroll();
    }
  }

  function handleMouseDown(pageNum: number) {
    isSelecting = true;
    selectionStartPage = pageNum;
    dispatch('setstartpage', {page: pageNum});
    dispatch('setendpage', {page: pageNum});
  }

  function handleMouseEnter(pageNum: number) {
    if (!isSelecting) return;

    const newStart = Math.min(selectionStartPage, pageNum);
    const newEnd = Math.max(selectionStartPage, pageNum);

    if (newStart !== tocStartPage) {
      dispatch('setstartpage', {page: newStart});
    }
    if (newEnd !== tocEndPage) {
      dispatch('setendpage', {page: newEnd});
    }
  }

  function handleMouseUp() {
    stopAutoScroll();
    isSelecting = false;
    selectionStartPage = 0;
  }

  function handleGridMouseMove(e: MouseEvent) {
    if (!isSelecting) return;
    checkAutoScroll(e.clientY);
  }

  function handleTouchStart(pageNum: number) {
    if (pressTimer) {
      clearTimeout(pressTimer);
    }
    pressTimer = window.setTimeout(() => {
      handleMouseDown(pageNum);
      pressTimer = null;
    }, 300);
  }

  function handleTouchMove(e: TouchEvent) {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    if (!isSelecting) return;

    e.preventDefault();

    const touch = e.touches[0];
    if (!touch) return;

    checkAutoScroll(touch.clientY);

    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!targetElement) return;

    const pageItem = targetElement.closest('[data-page-num]') as HTMLElement;

    if (pageItem && pageItem.dataset.pageNum) {
      const pageNum = parseInt(pageItem.dataset.pageNum, 10);
      if (!isNaN(pageNum)) {
        handleMouseEnter(pageNum);
      }
    }
  }

  function handleTouchEnd() {
    stopAutoScroll();
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (isSelecting) {
      handleMouseUp();
    }
  }

  function observeViewport(node: HTMLElement) {
    scrollContainer = node;

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const canvas = entry.target as HTMLCanvasElement;
            const pageNum = parseInt(canvas.dataset.pageNum || '0', 10);

            if (pageNum > 0 && instance && pdfServiceInstance) {
              const dpr = window.devicePixelRatio || 1;
              const canvasWidth = canvas.clientWidth;

              pdfServiceInstance.renderPageToCanvas(instance, pageNum, canvas, canvasWidth * dpr);

              canvas.style.width = `${canvasWidth}px`;
              canvas.style.height = 'auto';

              if (intersectionObserver) {
                intersectionObserver.unobserve(canvas);
              }
            }
          }
        });
      },
      {
        root: node,
        rootMargin: '300px',
      }
    );

    canvasesToObserve.forEach((canvas) => {
      if (intersectionObserver) {
        intersectionObserver.observe(canvas);
      }
    });
    canvasesToObserve = [];

    return {
      destroy() {
        if (intersectionObserver) {
          intersectionObserver.disconnect();
          intersectionObserver = null;
        }
      },
    };
  }

  function lazyRender(canvas: HTMLCanvasElement, {pageNum}: {pageNum: number}) {
    canvas.dataset.pageNum = pageNum.toString();

    if (intersectionObserver) {
      intersectionObserver.observe(canvas);
    } else {
      canvasesToObserve.push(canvas);
    }

    return {
      destroy() {
        if (intersectionObserver) {
          intersectionObserver.unobserve(canvas);
        } else {
          canvasesToObserve = canvasesToObserve.filter((c) => c !== canvas);
        }
      },
    };
  }
</script>

<div
  class="h-[85vh] rounded-lg"
  class:overflow-auto={mode === 'grid'}
  use:observeViewport={mode === 'grid' ? observeViewport : undefined}
  class:overflow-hidden={mode === 'single'}
  class:bg-gray-50={mode === 'grid'}
>
  {#if mode === 'single'}
    <div class="flex flex-col h-full">
      <div class="flex items-center flex-col justify-start w-full max-w-4xl px-4 py-3 bg-white border-b-2 border-black">
        <div class="flex z-10 items-center justify-between w-full max-w-full overflow-x-auto">
          <div class="text-gray-600 font-serif flex gap-1 sm:gap-2 items-center text-sm md:text-base md:gap-3">
            <span class="truncate max-w-20 md:max-w-xs">{filename}</span>
            <span class="text-gray-300">|</span>
            <span>{currentPage} / {totalPages}</span>

            {#if addPhysicalTocPage && jumpToTocPage && hasPreview}
              <button
                on:click={jumpToTocPage}
                class="p-1 rounded-lg hover:bg-gray-100 text-black border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                title={$t('tooltip.jump_toc')}
              >
                <ListOrdered
                  size={12}
                  class="hidden md:inline-block"
                /> ToC
              </button>
            {/if}
          </div>

          <div class="flex items-center sm:gap-1 md:gap-2">
            <button
              on:click={zoomOut}
              class="p-1 md:p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title={$t('tooltip.zoom_out')}
            >
              <ZoomOut size={20} />
            </button>
            <span class="min-w-[50px] text-center text-gray-600 text-sm md:text-base md:min-w-[60px]">
              {Math.round(scale * 100)}%
            </span>
            <button
              on:click={zoomIn}
              class="p-1 md:p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title={$t('tooltip.zoom_in')}
            >
              <ZoomIn size={20} />
            </button>
            <button
              on:click={resetZoom}
              class="p-1 md:p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title={$t('tooltip.reset')}
            >
              <RotateCw size={20} />
            </button>
          </div>
        </div>
      </div>

      <div class="relative flex items-center justify-center w-full flex-1 overflow-auto bg-gray-50">
        <button
          on:click={goToPrevPage}
          disabled={currentPage <= 1}
          class="absolute left-2 p-1 md:left-4 md:p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed z-10 border-2 border-black"
        >
          <ChevronLeft size={24} />
        </button>

        <div class="overflow-auto max-w-full p-4">
          <canvas
            class="max-w-full"
            id="pdf-canvas"
          ></canvas>
        </div>

        <button
          on:click={goToNextPage}
          disabled={currentPage >= totalPages}
          class="absolute right-2 p-1 md:right-4 md:p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed z-10 border-2 border-black"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  {:else if mode === 'grid'}
    <div
      class="grid grid-cols-2 gap-3 p-3 select-none md:grid-cols-3 md:gap-4 2xl:grid-cols-4 2xl:gap-5"
      class:cursor-grabbing={isSelecting}
      on:mouseup={handleMouseUp}
      on:mouseleave={handleMouseUp}
      on:touchmove={handleTouchMove}
      on:touchend={handleTouchEnd}
      on:touchcancel={handleTouchEnd}
      on:mousemove={handleGridMouseMove}
    >
      {#each gridPages as page (page.pageNum)}
        {@const isSelected = page.pageNum >= tocStartPage && page.pageNum <= tocEndPage}
        <div
          data-page-num={page.pageNum}
          class="relative rounded-lg overflow-hidden border-t-[2px] border-l-[2px] cursor-pointer bg-white transition-all duration-150 transform border-2"
          class:shadow-[3px_3px_0px]={isSelected}
          class:shadow-blue-400={isSelected}
          class:border-blue-500={isSelected}
          class:border-gray-500={!isSelected}
          class:scale-[1.02]={isSelected}
          on:mousedown={() => handleMouseDown(page.pageNum)}
          on:touchstart={() => handleTouchStart(page.pageNum)}
          on:mouseenter={() => handleMouseEnter(page.pageNum)}
          on:dragstart|preventDefault
        >
          {#if page.pageNum === tocStartPage}
            <span
              class="absolute -top-2.5 -left-2.5 z-10 rounded-full bg-blue-600 pr-2 pl-3 pt-3 text-xs font-bold text-white shadow-lg"
            >
              {$t('label.start')}
            </span>
          {/if}

          {#if page.pageNum === tocEndPage}
            <span
              class="absolute -bottom-2.5 -right-2.5 z-10 rounded-full bg-blue-600 pl-2 pr-3 pb-[10px] pt-[2px] text-xs font-bold text-white shadow-lg"
            >
              {$t('label.end')}
            </span>
          {/if}

          <canvas
            id={page.canvasId}
            class:cursor-grabbing={isSelecting}
            class="w-full border-b bg-white"
            use:lazyRender={{pageNum: page.pageNum}}
          ></canvas>

          <div class="text-center text-xs p-2 bg-white">
            {page.pageNum}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
