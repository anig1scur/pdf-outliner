<script lang="ts">
  import * as pdfjsLib from 'pdfjs-dist';
  import Dropzone from 'svelte-file-dropzone';
  import {PDFDocument, PDFName, rgb, StandardFonts} from 'pdf-lib';

  import TocEditor from '../components/TocEditor.svelte';
  import PDFViewer from '../components/PDFViewer.svelte';
  import {setOutline} from '../lib/pdf-outliner';
  import {tocItems} from '../stores';

  let yOffset = 0;
  let pdfDoc = null;
  let newPdfDoc = null;
  let currentPage = 1;
  let totalPages = 0;
  let pdfScale = 1.0;
  let pdfInstance = null;

  let pageRendering = false;
  let pageNumPending = null;

  pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

  tocItems.subscribe(updatePDF);

  async function createTocPage(doc, items, pages, level = 0, curPage = null) {
    let page = curPage || doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    yOffset = curPage ? yOffset : page.getHeight() - 20;

    if (level === 0 && !curPage) {
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
      if (yOffset < 50) {
        page = doc.addPage();
        yOffset = page.getHeight() - 50;
      }

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

      const targetPage = pages[Math.min(pages.length - 1, item.to - 1)];

      const ref = doc.context.register(
        doc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [50 + indent, yOffset, page.getWidth() - 50, yOffset + fontSize],
          Border: [0, 0, 0],
          Dest: [targetPage.ref, 'XYZ', 0, targetPage.getHeight(), 0],
        })
      );

      const existingAnnots = page.node.get(PDFName.of('Annots'));
      if (existingAnnots) {
        existingAnnots.push(ref);
      } else {
        page.node.set(PDFName.of('Annots'), doc.context.obj([ref]));
      }

      yOffset -= 20;

      if (item.children?.length) {
        const newYOffset = await createTocPage(doc, item.children, pages, level + 1, page);
        yOffset = newYOffset;
      }
    }

    return yOffset;
  }
  async function updatePDF() {
    if (!pdfDoc) return;

    try {
      newPdfDoc = await PDFDocument.create();

      const copiedPages = await newPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
      await createTocPage(newPdfDoc, $tocItems, copiedPages);

      copiedPages.forEach((page) => newPdfDoc.addPage(page));

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
  let dropzoneRef;
  let isDragging = false;

  const handleFileDrop = async (e) => {
    const {acceptedFiles} = e.detail;
    isDragging = false;

    if (acceptedFiles.length) {
      const file = acceptedFiles[0];
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        pdfDoc = await PDFDocument.load(uint8Array);

        const loadingTask = pdfjsLib.getDocument(uint8Array);
        pdfInstance = await loadingTask.promise;
        totalPages = pdfInstance.numPages;
        renderPage(pdfInstance, currentPage);
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    }
  };

  const handleDragEnter = () => {
    isDragging = true;
  };

  const handleDragLeave = () => {
    isDragging = false;
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
    if (!newPdfDoc) {
      return;
    }

    try {
      const pdfBytes = await newPdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], {type: 'application/pdf'});

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

<div class="flex p-4 gap-6 mx-auto w-[80%] justify-between">
  <TocEditor />
  <div class="flex flex-col flex-1">
    <div class="relative h-full">
      <Dropzone
        bind:this={dropzoneRef}
        containerClasses={pdfInstance ? 'opaciyu-0' : 'h-full'}
        accept=".pdf"
        disableDefaultStyles
        on:drop={handleFileDrop}
        on:dragenter={handleDragEnter}
        on:dragleave={handleDragLeave}
      >
        <div
          class="w-full absolute inset-0 p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors duration-200 {pdfInstance
            ? 'bg-transparent hover:bg-white/50'
            : ''}"
          class:border-blue-500={isDragging}
          class:bg-blue-50={isDragging}
        >
          {#if !pdfInstance || isDragging}
            <div class="absolute text-stone-500 inset-0 flex items-center justify-center">
              {#if isDragging}
                <p>Drop your PDF file here...</p>
              {:else}
                <p>Drag and drop your PDF file here, or click to select</p>
              {/if}
            </div>
          {/if}
        </div>
      </Dropzone>

      <div class={pdfInstance ? 'block' : 'hidden'}>
        <button
          class="absolute top-2 right-2 z-10 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          on:click={exportPDFWithOutline}
        >
          Generate Outlined PDF
        </button>
        <PDFViewer
          {currentPage}
          {totalPages}
          {pdfScale}
        />
      </div>
    </div>
  </div>
</div>
