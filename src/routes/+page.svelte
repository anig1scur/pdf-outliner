<script lang="ts">
  import * as pdfjsLib from 'pdfjs-dist';
  import Dropzone from 'svelte-file-dropzone';
  import {PDFDocument, PDFName, rgb, StandardFonts} from 'pdf-lib';

  import TocEditor from '../components/TocEditor.svelte';
  import PDFViewer from '../components/PDFViewer.svelte';
  import {setOutline} from '../lib/pdf-outliner';
  import {debounce} from '../lib';
  import {tocItems} from '../stores';

  let yOffset = 0;
  let filename = '';
  let pdfDoc = null;
  let newPdfDoc = null;
  let currentPage = 1;
  let totalPages = 0;
  let pdfScale = 1.0;
  let pdfInstance = null;

  let pageRendering = false;
  let pageNumPending = null;

  pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

  const debouncedUpdatePDF = debounce(updatePDF, 400);

  tocItems.subscribe(debouncedUpdatePDF);

  async function createTocPage(doc, items, pages, level = 0, curPage = null) {
    const [firstPage] = pdfDoc.getPages();
    const {width: originalWidth, height: originalHeight} = firstPage.getSize();

    let page = curPage || doc.addPage([originalWidth, originalHeight]);
    const regularFont = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    yOffset = curPage ? yOffset : (page.getHeight() / 3) * 2;

    if (level === 0 && !curPage) {
      const titleFontSize = 18;
      page.drawText('Table of Contents', {
        x: 50,
        y: yOffset,
        size: titleFontSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yOffset -= titleFontSize + 20;
    }

    for (const item of items) {
      if (yOffset < 50) {
        page = doc.addPage([originalWidth, originalHeight]);
        yOffset = page.getHeight() - 50;
      }

      const indent = level * 20;
      const textFont = level === 0 ? boldFont : regularFont;
      const color = level === 0 ? rgb(0, 0, 0) : rgb(0.3, 0.3, 0.3);
      const fontSize = level === 0 ? 10 : 9;
      const lineSpacing = fontSize + (level === 0 ? 8 : 6);

      const titleX = 50 + indent;
      const titleWidth = page.getWidth() - 100 - indent;
      if (level == 0) {
        yOffset -= 8;
      }
      page.drawText(item.title, {
        x: titleX,
        y: yOffset,
        size: fontSize,
        font: textFont,
        color,
        maxWidth: titleWidth,
      });

      if (level === 0) {
        const dotsXStart = titleX + item.title.length * (fontSize * 0.5) + 10;
        const dotsXEnd = page.getWidth() - 65;
        for (let x = dotsXStart; x < dotsXEnd; x += 5) {
          page.drawText('.', {
            x,
            y: yOffset - 1,
            size: fontSize * 0.6,
            font: regularFont,
            color: rgb(0.2, 0.2, 0.2),
          });
        }
      }

      const pageNumText = String(item.to);
      const pageNumWidth = boldFont.widthOfTextAtSize(pageNumText, fontSize);
      page.drawText(pageNumText, {
        x: page.getWidth() - 50 - pageNumWidth,
        y: yOffset,
        size: fontSize,
        font: textFont,
        color: rgb(0, 0, 0),
      });

      const targetPage = pages[Math.min(pages.length - 1, item.to - 1)];
      const ref = doc.context.register(
        doc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [titleX, yOffset - 2, page.getWidth() - 50, yOffset + fontSize],
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

      yOffset -= lineSpacing;

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
      filename = file.name;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        pdfDoc = await PDFDocument.load(uint8Array);

        updatePDF();

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
      downloadLink.download = `${filename.substring(0, filename.length - 4)}_outlined.pdf`;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };
</script>

<div class="flex mt-8 p-4 gap-12 mx-auto w-[80%] justify-between">
  <TocEditor />
  <div class="flex flex-col flex-1">
    <div class="relative h-fit pb-8 min-h-[85vh]">
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
          class="absolute top-3 right-3 z-20 btn"
          on:click={exportPDFWithOutline}
        >
          Generate Outlined PDF
        </button>
        <PDFViewer
          {filename}
          {currentPage}
          {totalPages}
          {pdfScale}
        />
      </div>
    </div>
  </div>
</div>

<svelte:head>
  <title>PDF OUTLINER · Add or edit PDF Outlines / Table of Contents in browser</title>
</svelte:head>
