<script>
  export let currentPage = 1;
  export let totalPages = 0;
  export let pdfScale = 1.0;
  export let filename = '';

  const updateCanvas = () => {
    const event = new CustomEvent('scaleChange', {detail: pdfScale});
    dispatchEvent(event);
  };
</script>

<div class="flex flex-col items-center mt-4 gap-6">
  <div class="text-gray-600 font-serif z-10 flex gap-3 items-start justify-self-start w-full ml-8">
    <span>{filename}</span>
    <span class="text-gray-300"> | </span>
    <span>{currentPage} / {totalPages}</span>
  </div>

  <canvas id="pdf-canvas"></canvas>
</div>
