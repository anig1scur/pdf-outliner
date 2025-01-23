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
    // const loadPDF = async (file) => {
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

  const exportPDFWithOutline = async () => {
    if (!pdfDoc) {
      return;
    }

    try {
      // Convert outlines to PDF outline format
      const convertOutlinesToPDFFormat = (items) => {
        return items.map((item) => ({
          title: item.title,
          to: [{num: item.to, gen: 0}, {name: 'XYZ'}, null, null, null],
          bold: item.bold,
          italic: item.italic,
          children: item.children ? convertOutlinesToPDFFormat(item.children) : [],
        }));
      };

      const pdfOutlines = [
        {
          title: 'New Item 1',
          to: 1,
          italic: false,
          bold: false,
          children: [
            {
              title: 'New Item 4',
              to: 2,
              italic: false,
              bold: false,
              children: [],
              open: true,
            },
          ],
          open: true,
        },
        {
          title: 'New Item 2',
          to: 3,
          italic: false,
          bold: false,
          children: [
            {
              title: 'New Item 4',
              to: 6,
              italic: false,
              bold: false,
              children: [],
              open: true,
            },
          ],
          open: true,
        },
        {
          title: 'New Item 3',
          to: 4,
          italic: false,
          bold: false,
          children: [],
          open: true,
        },
      ];
      setOutline(pdfDoc, pdfOutlines);

      const modifiedPdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([modifiedPdfBytes], {type: 'application/pdf'});

      // Create download link
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = 'document_with_outline.pdf';

      // Trigger download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Cleanup
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

  const addTocItem = () => {
    tocItems = [...tocItems, {id: Date.now(), level: tocItems.length + 1, title: 'New Section', page: 1}];
  };

  const updateTocItem = (id, updates) => {
    tocItems = tocItems.map((item) => (item.id === id ? {...item, ...updates} : item));
  };

  const deleteTocItem = (id) => {
    tocItems = tocItems.filter((item) => item.id !== id);
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

    {#each tocItems as item (item.id)}
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
