<script>
  export let currentPage = 1;
  export let totalPages = 0;
  export let pdfScale = 1.0;

  const handleZoomIn = () => {
    pdfScale += 0.1;
    updateCanvas();
  };

  const handleZoomOut = () => {
    if (pdfScale > 0.2) {
      pdfScale -= 0.1;
      updateCanvas();
    }
  };

  const updateCanvas = () => {
    const event = new CustomEvent("scaleChange", { detail: pdfScale });
    dispatchEvent(event);
  };
</script>

<div class="pdf-viewer">
  <div class="controls">
    <button on:click="{handleZoomOut}">缩小</button>
    <span>Page {currentPage} / {totalPages}</span>
    <button on:click="{handleZoomIn}">放大</button>
  </div>

  <canvas id="pdf-canvas"></canvas>
</div>

<style>
  .pdf-viewer {
    width: 70%;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .controls {
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  button {
    padding: 0.5rem 1rem;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  button:hover {
    background-color: #0056b3;
  }
  canvas {
    border: 1px solid #ddd;
    max-width: 100%;
    height: auto;
  }
</style>
