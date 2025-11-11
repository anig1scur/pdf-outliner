<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import {
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    RotateCw,
  } from 'lucide-svelte';

  import { pdfService } from '../stores';
  import { type PDFService } from '../lib/pdf-service';
  import type { PDFState } from '../lib/pdf-service';

  export let pdfState: PDFState;
  export let mode: 'single' | 'grid' = 'single';
  export let tocStartPage: number;
  export let tocEndPage: number;

  const dispatch = createEventDispatcher();

  let gridPages: { pageNum: number; canvasId: string }[] = [];
  let pdfServiceInstance: PDFService | null = null;
  export let isSettingStart: boolean;
  let intersectionObserver: IntersectionObserver | null = null;
  let scrollContainer: HTMLElement;

  let canvasesToObserve: HTMLCanvasElement[] = [];

  pdfService.subscribe((val) => (pdfServiceInstance = val));

  $: ({ filename, currentPage, scale, totalPages } = pdfState);

  const goToNextPage = () => {
    if (pdfState.currentPage < pdfState.totalPages) {
      pdfState.currentPage += 1;
    }
  };

  const goToPrevPage = () => {
    if (pdfState.currentPage > 1) {
      pdfState.currentPage -= 1;
    }
  };

  const zoomIn = () => {
    pdfState.scale = Math.min(pdfState.scale + 0.15, 2.0);
  };

  const zoomOut = () => {
    pdfState.scale = Math.max(pdfState.scale - 0.15, 0.5);
  };

  const resetZoom = () => {
    pdfState.scale = 1.0;
  };

  $: if (pdfState.instance && mode === 'grid') {
    gridPages = Array.from({ length: pdfState.totalPages }, (_, i) => ({
      pageNum: i + 1,
      canvasId: `thumb-canvas-${i + 1}`,
    }));
  }

  function handleGridClick(pageNum: number) {
    if (isSettingStart) {
      dispatch('setstartpage', { page: pageNum });
      if (pageNum > tocEndPage) {
        dispatch('setendpage', { page: pageNum });
      }
      isSettingStart = false;
    } else {
      if (pageNum < tocStartPage) {
        dispatch('setstartpage', { page: pageNum });
      } else {
        dispatch('setendpage', { page: pageNum });
      }
      isSettingStart = true;
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

            if (pageNum > 0 && pdfState.instance && pdfServiceInstance) {
              const dpr = window.devicePixelRatio || 1;
              const canvasWidth = canvas.clientWidth;

              pdfServiceInstance.renderPageToCanvas(
                pdfState.instance,
                pageNum,
                canvas,
                canvasWidth * dpr
              );

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

  function lazyRender(
    canvas: HTMLCanvasElement,
    { pageNum }: { pageNum: number }
  ) {
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
  class="h-[85vh] rounded-b-lg"
  class:overflow-auto={mode === 'grid'}
  use:observeViewport={mode === 'grid' ? observeViewport : undefined}
  class:overflow-hidden={mode === 'single'}
  class:bg-gray-50={mode === 'grid'}
>
  {#if mode === 'single'}
    <div class="flex flex-col h-full">
      <div
        class="flex items-center flex-col justify-start w-full max-w-4xl px-4 py-3 bg-white"
      >
        <div
          class="flex z-10 items-center justify-between w-full max-w-full overflow-x-auto"
        >
          <div class="text-gray-600 font-serif flex gap-3 items-center">
            <span class="truncate max-w-xs">{filename}</span>
            <span class="text-gray-300">|</span>
            <span>{currentPage} / {totalPages}</span>
          </div>

          <div class="flex items-center gap-2">
            <button
              on:click={zoomOut}
              class="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title="zoom out"
            >
              <ZoomOut size={20} />
            </button>
            <span class="min-w-[60px] text-center text-gray-600">
              {Math.round(scale * 100)}%
            </span>
            <button
              on:click={zoomIn}
              class="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title="zoom in"
            >
              <ZoomIn size={20} />
            </button>
            <button
              on:click={resetZoom}
              class="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title="reset"
            >
              <RotateCw size={20} />
            </button>
          </div>
        </div>
      </div>

      <div
        class="relative flex items-center justify-center w-full flex-1 overflow-auto bg-gray-50"
      >
        <button
          on:click={goToPrevPage}
          disabled={currentPage <= 1}
          class="absolute left-4 p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed z-10"
        >
          <ChevronLeft size={24} />
        </button>

        <div class="overflow-auto max-w-full p-4">
          <canvas class="max-w-full" id="pdf-canvas"></canvas>
        </div>

        <button
          on:click={goToNextPage}
          disabled={currentPage >= totalPages}
          class="absolute right-4 p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed z-10"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  {:else if mode === 'grid'}
    <div class="grid grid-cols-3 gap-5 p-4">
      {#each gridPages as page (page.pageNum)}
        <div
          class="rounded-md overflow-hidden shadow cursor-pointer bg-white transition-all duration-150 transform hover:scale-[1.03]"
          class:ring-4={page.pageNum >= tocStartPage &&
            page.pageNum <= tocEndPage}
          class:ring-blue-500={page.pageNum >= tocStartPage &&
            page.pageNum <= tocEndPage}
          class:ring-offset-2={page.pageNum >= tocStartPage &&
            page.pageNum <= tocEndPage}
          class:border-transparent={!(page.pageNum >= tocStartPage &&
            page.pageNum <= tocEndPage)}
          on:click={() => handleGridClick(page.pageNum)}
        >
          <canvas
            id={page.canvasId}
            class="w-full border-b bg-white"
            use:lazyRender={{ pageNum: page.pageNum }}
          ></canvas>

          <div class="text-center text-xs p-2 font-mono bg-white">
            {page.pageNum}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>