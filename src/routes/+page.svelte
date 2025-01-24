<script lang="ts">
  import {onMount} from 'svelte';
  import TocEditor from '../components/TocEditor.svelte';
  import PDFViewer from '../components/PDFViewer.svelte';
  import {setOutline} from '../lib/pdf-outliner';
  import {PDFDocument, PDFName, rgb, StandardFonts} from 'pdf-lib';
  import {tocItems} from '../stores';
  import * as pdfjsLib from 'pdfjs-dist';

  let pdfDoc = null;
  let currentPage = 1;
  let totalPages = 0;
  let pdfScale = 1.0;
  let pdfInstance = null;

  let pageRendering = false;
  let pageNumPending = null;

  pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

  tocItems.subscribe(updatePDF);

  async function createTocPage(pdfDoc, items, level = 0) {
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    let yOffset = page.getHeight() - 50;

    if (level === 0) {
      page.drawText('ToC', {
        x: 50,
        y: yOffset,
        size: 16,
        font,
        color: rgb(0, 0, 0),
      });
      yOffset -= 30;
    }

    for (const item of items) {
      const indent = level * 20;
      page.drawText(item.title, {
        x: 50 + indent,
        y: yOffset,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      page.drawText(String(item.to), {
        x: page.getWidth() - 50,
        y: yOffset,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      const ref = pdfDoc.context.register(
        pdfDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [50 + indent, yOffset - 2, page.getWidth() - 50, yOffset + fontSize],
          Border: [0, 0, 0],
          Dest: [pdfDoc.getPage(0).ref, 'XYZ', 0, page.getHeight(), 0],
        })
      );
      page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([ref]));

      yOffset -= 20;

      if (item.children?.length) {
        yOffset = await createTocPage(pdfDoc, item.children, level + 1);
      }
    }

    return yOffset;
  }

  async function updatePDF() {
    if (!pdfDoc) return;

    try {
      const newPdfDoc = await PDFDocument.create();
      await createTocPage(newPdfDoc, $tocItems);

      const pages = await newPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
      pages.forEach((page) => newPdfDoc.addPage(page));

      setOutline(newPdfDoc, $tocItems);

      const pdfBytes = await newPdfDoc.save();
      const loadingTask = pdfjsLib.getDocument(pdfBytes);

      pdfInstance = await loadingTask.promise;

      totalPages = pdfInstance.numPages;
      renderPage(pdfInstance, currentPage);
    } catch (error) {
      console.error('Error updating PDF:', error);
    }
  }

  const loadPDF = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const fileReader = new FileReader();
      fileReader.onload = async function () {
        const arrayBuffer = new Uint8Array(this.result);
        pdfDoc = await PDFDocument.load(arrayBuffer);

        const loadingTask = pdfjsLib.getDocument(arrayBuffer);
        pdfInstance = await loadingTask.promise;
        totalPages = pdfInstance.numPages;
        renderPage(pdfInstance, currentPage);
      };
      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  const renderPage = async (pdf, pageNum) => {
    if (pageRendering) {
      pageNumPending = pageNum;
    } else {
      pageRendering = true;

      const canvas = document.getElementById('pdf-canvas');
      const page = await pdf.getPage(pageNum);

      const viewport = page.getViewport({scale: pdfScale});
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: canvas.getContext('2d'),
        viewport,
      };

      const renderTask = page.render(renderContext);
      renderTask.promise.then(function () {
        pageRendering = false;
        if (pageNumPending !== null) {
          // Waited page must be rendered
          renderPage(pdfInstance, pageNumPending);
          // Must be set to null to prevent infinite loop
          pageNumPending = null;
        }
      });
    }
  };

  const exportPDFWithOutline = async () => {
    if (!pdfDoc) {
      return;
    }

    try {
      const newPdfDoc = await PDFDocument.create();

      await createTocPage(newPdfDoc, $tocItems);

      const pages = await newPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
      pages.forEach((page) => newPdfDoc.addPage(page));

      setOutline(newPdfDoc, $tocItems);

      const modifiedPdfBytes = await newPdfDoc.save();
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
</script>

<div class="flex">
  <TocEditor />
  <div class="flex flex-col">
    <div>
      <input
        type="file"
        accept=".pdf"
        on:change={loadPDF}
      />
      <button on:click={exportPDFWithOutline}>generate outlined PDF</button>
    </div>
    <PDFViewer
      {currentPage}
      {totalPages}
      {pdfScale}
    />
  </div>
</div>
