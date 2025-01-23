<script>
  export let currentPage = 1;
  export let totalPages = 0;
  export let pdfScale = 1.0;

  const updateCanvas = () => {
    const event = new CustomEvent('scaleChange', {detail: pdfScale});
    dispatchEvent(event);
  };
</script>

<div class="pdf-viewer">
  <div class="controls">
    <span>Page {currentPage} / {totalPages}</span>
  </div>

  <canvas id="pdf-canvas"></canvas>
</div>
