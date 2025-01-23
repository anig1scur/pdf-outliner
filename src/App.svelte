<script lang="ts">
  import {onMount} from 'svelte';
  import TocItem from './components/TocItem.svelte';
  import PDFViewer from './components/PDFViewer.svelte';
  import {setOutline} from './utils/pdf-outliner';
  import {PDFDocument} from 'pdf-lib';
  import * as pdfjsLib from 'pdfjs-dist';

  let pdfFile = null;
  let pdfDoc = null;
  let tocItems = [];
  let currentPage = 1;
  let totalPages = 0;
  let pdfScale = 1.0;

  pdfjsLib.GlobalWorkerOptions.workerSrc = `http://localhost:8080/pdf.worker.min.mjs`;

  const loadPDF = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const fileReader = new FileReader();
      fileReader.onload = async function () {
        const arrayBuffer = new Uint8Array(this.result);
        pdfDoc = await PDFDocument.load(arrayBuffer);

        const loadingTask = pdfjsLib.getDocument(arrayBuffer);
        const pdf = await loadingTask.promise;
        totalPages = pdf.numPages;
        renderPage(pdf, currentPage);
      };
      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  const renderPage = async (pdf, pageNum) => {
    const canvas = document.getElementById('pdf-canvas');
    const page = await pdf.getPage(pageNum);

    const viewport = page.getViewport({scale: pdfScale});
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: canvas.getContext('2d'),
      viewport,
    };
    await page.render(renderContext).promise;
  };

  const addTocItem = () => {
    tocItems = [
      ...tocItems,
      {
        title: 'New Section',
        to: 1,
        italic: false,
        bold: false,
        children: [],
        open: true,
      },
    ];
  };

  const updateTocItem = (item, updates) => {
    const updateItemRecursive = (items) => {
      return items.map((currentItem) => {
        if (currentItem === item) {
          return {...currentItem, ...updates};
        }
        if (currentItem.children?.length) {
          return {
            ...currentItem,
            children: updateItemRecursive(currentItem.children),
          };
        }
        return currentItem;
      });
    };

    tocItems = updateItemRecursive(tocItems);
  };

  const deleteTocItem = (itemToDelete) => {
    const deleteItemRecursive = (items) => {
      return items.filter((item) => {
        if (item === itemToDelete) {
          return false;
        }
        if (item.children?.length) {
          item.children = deleteItemRecursive(item.children);
        }
        return true;
      });
    };

    tocItems = deleteItemRecursive(tocItems);
  };

  const exportPDFWithOutline = async () => {
    if (!pdfDoc) {
      return;
    }

    try {
      setOutline(pdfDoc, tocItems);

      const modifiedPdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([modifiedPdfBytes], {type: 'application/pdf'});

      const downloadUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = 'document_with_outline.pdf';

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };

  const generatePDF = async () => {
    if (!pdfDoc) return;

    const tocPage = pdfDoc.addPage();
    const {width, height} = tocPage.getSize();

    tocPage.drawText('Table of Contents', {x: 50, y: height - 50, size: 16});
    let yOffset = height - 80;

    for (const item of tocItems) {
      tocPage.drawText(`${item.level} ${item.title}`, {
        x: 50 + (item.level.toString().split('.').length - 1) * 20,
        y: yOffset,
        size: 12,
      });
      tocPage.drawText(item.page.toString(), {x: width - 50, y: yOffset, size: 12});
      yOffset -= 20;
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], {type: 'application/pdf'});
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'document-with-toc.pdf';
    link.click();
  };
</script>

<div class="app">
  <div class="sidebar">
    <input
      type="file"
      accept=".pdf"
      on:change={loadPDF}
    />
    <button on:click={addTocItem}>添加目录项</button>

    {#each tocItems as item, idx (idx)}
      <TocItem
        {item}
        onUpdate={updateTocItem}
        onDelete={deleteTocItem}
      />
    {/each}

    <button on:click={exportPDFWithOutline}>生成PDF</button>
  </div>

  <PDFViewer
    {currentPage}
    {totalPages}
    {pdfScale}
  />
</div>

<style>
  .app {
    display: flex;
  }
  .sidebar {
    width: 30%;
    padding: 1rem;
  }
</style>
