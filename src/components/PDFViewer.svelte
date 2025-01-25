<script>
  export let pdfState;
  import {ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw} from 'lucide-svelte';

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

  $: ({filename, currentPage, scale, totalPages} = pdfState);
</script>

<div class="flex flex-col items-center justify-start w-full max-w-full overflow-x-auto">
  <div class="flex z-10 items-center justify-start w-full max-w-4xl px-4 py-3 bg-white">
    <div class="text-gray-600 font-serif flex gap-3 items-center">
      <span class="truncate max-w-xs">{filename}</span>
      <span class="text-gray-300">|</span>
      <span>{currentPage} / {totalPages}</span>
    </div>

    <div class="flex items-center gap-2 ml-3">
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

  <div class="relative flex items-center justify-center w-full">
    <button
      on:click={goToPrevPage}
      disabled={currentPage <= 1}
      class="absolute left-4 p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
      class="absolute right-4 p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <ChevronRight size={24} />
    </button>
  </div>
</div>
