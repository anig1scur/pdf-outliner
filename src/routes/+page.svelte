<script lang="ts">
  import {onMount} from 'svelte';
  import * as pdfjsLib from 'pdfjs-dist';
  import Dropzone from 'svelte-file-dropzone';
  import {PDFDocument} from 'pdf-lib';

  import TocEditor from '../components/TocEditor.svelte';
  import PDFViewer from '../components/PDFViewer.svelte';
  import Logo from '../assets/logo-dark.svelte';

  import {setOutline} from '../lib/pdf-outliner';
  import {PDFService, type PDFState} from '../lib/pdf-service';
  import {tocItems, pdfService, showNumberedList} from '../stores';
  import {debounce} from '../lib';

  let isDragging = false;

  let pdfState: PDFState = {
    doc: null,
    newDoc: null,
    filename: '',
    currentPage: 1,
    totalPages: 0,
    scale: 1.0,
  };

  onMount(() => {
    $pdfService = new PDFService();
  });

  $: {
    $pdfService.renderPage(pdfState.instance, pdfState.currentPage, pdfState.scale);
  }

  const updatePDF = async () => {
    if (!pdfState.doc) return;

    try {
      // Create new PDF with TOC
      const newDoc = await $pdfService.createTocPage(pdfState.doc, $tocItems);

      setOutline(newDoc, $tocItems);
      // Convert to viewable format
      const pdfBytes = await newDoc.save();
      const loadingTask = pdfjsLib.getDocument(pdfBytes);
      pdfState.instance = await loadingTask.promise;
      pdfState.totalPages = pdfState.instance.numPages;

      // Render first page
      await $pdfService.renderPage(pdfState.instance, pdfState.currentPage, pdfState.scale);

      // Store for export
      pdfState.newDoc = newDoc;
    } catch (error) {
      console.error('Error updating PDF:', error);
    }
  };

  const debouncedUpdatePDF = debounce(updatePDF, 300);
  tocItems.subscribe(debouncedUpdatePDF);
  showNumberedList.subscribe(debouncedUpdatePDF);

  const handleFileDrop = async (e: CustomEvent) => {
    const {acceptedFiles} = e.detail;
    isDragging = false;

    if (acceptedFiles.length) {
      const file = acceptedFiles[0];
      pdfState.filename = file.name;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Load PDF document
        pdfState.doc = await PDFDocument.load(uint8Array);

        // Create viewable instance
        const loadingTask = pdfjsLib.getDocument(uint8Array);
        pdfState.instance = await loadingTask.promise;
        pdfState.totalPages = pdfState.instance.numPages;

        await updatePDF();

        await $pdfService.renderPage(pdfState.instance, pdfState.currentPage, pdfState.scale);
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    }
  };

  const exportPDF = async () => {
    if (!pdfState.newDoc) return;

    try {
      const pdfBytes = await pdfState.newDoc.save();
      const pdfBlob = new Blob([pdfBytes], {type: 'application/pdf'});
      const url = URL.createObjectURL(pdfBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = pdfState.filename.replace('.pdf', '_outlined.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };
</script>

<div class="flex mt-8 p-4 gap-12 mx-auto w-[80%] font-mono justify-between">
  <div>
    <div class="flex items-center gap-6">
      <span class="text-3xl font-semibold">PDF Outliner</span>
      <Logo />
    </div>
    <div class="border-dashed border-gray-100 rounded border-2 my-4 p-2">
      <input
        bind:checked={$showNumberedList}
        type="checkbox"
        id="show_numbered_list"
        name="show_numbered_list"
      />
      <label for="show_numbered_list">with numbered list</label>
    </div>
    <TocEditor />
  </div>
  <div class="flex flex-col flex-1">
    <div class="relative h-fit pb-8 min-h-[85vh]">
      <Dropzone
        containerClasses={pdfState.instance ? '' : 'h-full'}
        accept=".pdf"
        disableDefaultStyles
        on:drop={handleFileDrop}
        on:dragenter={() => (isDragging = true)}
        on:dragleave={() => (isDragging = false)}
      >
        <div
          class="max-w-5xl w-full absolute inset-0 p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors duration-200 {pdfState.instance
            ? 'bg-transparent hover:bg-white/50'
            : ''}"
          class:border-blue-500={isDragging}
          class:bg-blue-50={isDragging}
        >
          {#if !pdfState.instance || isDragging}
            <div class="absolute text-stone-500 inset-0 flex items-center justify-center">
              <p class="px-2">
                {isDragging ? 'Drop your PDF file here...' : 'Drag and drop your PDF file here, or click to select'}
              </p>
            </div>
          {/if}
        </div>
      </Dropzone>

      {#if pdfState.instance}
        <button
          class="absolute top-3 right-3 z-20 btn"
          on:click={exportPDF}
        >
          Generate Outlined PDF
        </button>
        <PDFViewer bind:pdfState />
      {/if}
    </div>
  </div>
</div>
<svelte:head>
  <title>PDF OUTLINER · Add or edit PDF Outlines / Table of Contents in browser</title>
</svelte:head>
