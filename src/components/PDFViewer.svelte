<script>
  export let currentPage = 1;
  export let totalPages = 0;
  export let pdfScale = 1.0;

  const updateCanvas = () => {
    const event = new CustomEvent('scaleChange', {detail: pdfScale});
    dispatchEvent(event);
  };
</script>

<div class="flex flex-col items-center mt-3 gap-2">
  <div class="controls">
    <span class="text-stone-500">Page {currentPage} / {totalPages}</span>
  </div>

  <canvas id="pdf-canvas"></canvas>
</div>
