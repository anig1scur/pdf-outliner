<script lang="ts">
  import {createEventDispatcher, tick} from 'svelte';
  import {ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, ListOrdered} from 'lucide-svelte';

  import {pdfService} from '../stores';
  import {type PDFService} from '../lib/pdf-service';
  import type {PDFState} from '../lib/pdf-service';

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
  export let isSettingStart: boolean;
  let intersectionObserver: IntersectionObserver | null = null;
  let scrollContainer: HTMLElement;

  let canvasesToObserve: HTMLCanvasElement[] = [];

  pdfService.subscribe((val) => (pdfServiceInstance = val));

  $: ({filename, currentPage, scale, totalPages} = pdfState);

  $: if (mode === 'single' && pdfState.instance && pdfState.currentPage && pdfState.scale) {
    (async () => {
      await tick();
      const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
      if (!canvas || !pdfState.instance) return;

      const page = await pdfState.instance.getPage(pdfState.currentPage);

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({scale: pdfState.scale});

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

      await page.render(renderContext).promise;
    })();
  }

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
    gridPages = Array.from({length: pdfState.totalPages}, (_, i) => ({
      pageNum: i + 1,
      canvasId: `thumb-canvas-${i + 1}`,
    }));
  }

  function handleGridClick(pageNum: number) {
    if (isSettingStart) {
      dispatch('setstartpage', {page: pageNum});
      if (pageNum > tocEndPage) {
        dispatch('setendpage', {page: pageNum});
      }
      isSettingStart = false;
    } else {
      if (pageNum < tocStartPage) {
        dispatch('setstartpage', {page: pageNum});
      } else {
        dispatch('setendpage', {page: pageNum});
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

              pdfServiceInstance.renderPageToCanvas(pdfState.instance, pageNum, canvas, canvasWidth * dpr);

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
                title="Jump to inserted ToC page"
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
              title="zoom out"
            >
              <ZoomOut size={20} />
            </button>
            <span class="min-w-[50px] text-center text-gray-600 text-sm md:text-base md:min-w-[60px]">
              {Math.round(scale * 100)}%
            </span>
            <button
              on:click={zoomIn}
              class="p-1 md:p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title="zoom in"
            >
              <ZoomIn size={20} />
            </button>
            <button
              on:click={resetZoom}
              class="p-1 md:p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title="reset"
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
    <div class="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 md:gap-4 2xl:grid-cols-4 2xl:gap-5">
      {#each gridPages as page (page.pageNum)}
        <div
          class="rounded-lg overflow-hidden border-t-[2px] shadow-blue-400 border-gray-500 border-2 border-l-[2px] cursor-pointer bg-white transition-all duration-150 transform"
          class:shadow-[4px_4px_0px]={page.pageNum >= tocStartPage && page.pageNum <= tocEndPage}
          hover:-translate-x-1
          hover:-translate-y-1
          on:click={() => handleGridClick(page.pageNum)}
        >
          <canvas
            id={page.canvasId}
            class="w-full border-b bg-white"
            use:lazyRender={{pageNum: page.pageNum}}
          ></canvas>

          <div class="text-center text-xs p-2 font-mono bg-white">
            {page.pageNum}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
