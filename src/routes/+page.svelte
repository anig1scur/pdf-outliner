<script lang="ts">
  import {onMount, tick} from 'svelte';
  import * as pdfjsLib from 'pdfjs-dist';
  import Dropzone from 'svelte-file-dropzone';
  import {PDFDocument} from 'pdf-lib';
  import {Eye, EyeOff, X, EyeIcon, PencilIcon} from 'lucide-svelte';
  import {slide, fade, fly} from 'svelte/transition';

  import TocEditor from '../components/TocEditor.svelte';
  import PDFViewer from '../components/PDFViewer.svelte';
  import Logo from '../assets/logo-dark.svelte';
  import Toast from '../components/Toast.svelte';

  import {setOutline} from '../lib/pdf-outliner';
  import {PDFService, type PDFState, type TocItem} from '../lib/pdf-service';
  import {tocItems, pdfService, type TocConfig} from '../stores';
  import {debounce} from '../lib';
  import {tocConfig} from '../stores';

  let isTocConfigExpanded = false;
  let addPhysicalTocPage = true;

  // New Modal State
  let showOffsetModal = false;
  let pendingTocItems: TocItem[] = [];
  let firstTocItem: TocItem | null = null;
  let offsetPreviewPageNum = 1;

  // Toast State
  let toastProps = {
    show: false,
    message: '',
    type: 'success' as 'success' | 'error',
  };

  // AI Error State
  let aiError: string | null = null;
  let hasShownTocHint = false;

  let originalPdfInstance: pdfjsLib.PDFDocumentProxy | null = null;
  let previewPdfInstance: pdfjsLib.PDFDocumentProxy | null = null;
  let tocPageCount = 0;
  let isPreviewMode = false;

  $: if (showOffsetModal) {
    offsetPreviewPageNum = tocEndPage + 1;
  }

  const toggleExpand = () => {
    isTocConfigExpanded = !isTocConfigExpanded;
  };

  let config: TocConfig;
  tocConfig.subscribe((value) => (config = value));

  function updateTocField(fieldPath, value) {
    tocConfig.update((cfg) => {
      const keys = fieldPath.split('.');
      let target = cfg;
      keys.slice(0, -1).forEach((key) => (target = target[key]));
      target[keys[keys.length - 1]] = value;
      return cfg;
    });
  }

  let isDragging = false;
  let isAiLoading = false;
  let isFileLoading = false;
  let tocStartPage = 1;
  let tocEndPage = 1;
  let isSettingStart = true;

  let pdfState: PDFState = {
    doc: null,
    newDoc: null,
    instance: null,
    filename: '',
    currentPage: 1,
    totalPages: 0,
    scale: 1.0,
  };

  onMount(() => {
    $pdfService = new PDFService();
  });

  $: {
    if (pdfState.instance && pdfState.currentPage && $pdfService && isPreviewMode) {
      $pdfService.renderPage(pdfState.instance, pdfState.currentPage, pdfState.scale);
    }
  }

  const updateViewerInstance = () => {
    if (isPreviewMode && previewPdfInstance) {
      pdfState.instance = previewPdfInstance;
      pdfState.totalPages = previewPdfInstance.numPages;
    } else if (originalPdfInstance) {
      pdfState.instance = originalPdfInstance;
      pdfState.totalPages = originalPdfInstance.numPages;
    } else {
      pdfState.instance = null;
      pdfState.totalPages = 0;
    }
    pdfState = {...pdfState};
  };

  const togglePreviewMode = () => {
    if (!previewPdfInstance) {
      toastProps = {
        show: true,
        message: 'Please edit the ToC first to generate a preview.',
        type: 'error',
      };
      return;
    }
    isPreviewMode = !isPreviewMode;
    pdfState.currentPage = 1;
    updateViewerInstance();
  };

  const updatePDF = async () => {
    if (!pdfState.doc || !$pdfService) return;

    try {
      const currentPageBackup = pdfState.currentPage;

      const {newDoc, tocPageCount: count} = await $pdfService.createTocPage(
        pdfState.doc,
        $tocItems,
        addPhysicalTocPage,
        config.insertAtPage
      );
      tocPageCount = count;

      setOutline(newDoc, $tocItems, config.pageOffset, tocPageCount);

      const pdfBytes = await newDoc.save();
      const loadingTask = pdfjsLib.getDocument(pdfBytes);

      previewPdfInstance = await loadingTask.promise;
      pdfState.newDoc = newDoc;

      if (isPreviewMode) {
        updateViewerInstance();
        if (currentPageBackup <= pdfState.totalPages) {
          pdfState.currentPage = currentPageBackup;
        } else {
          pdfState.currentPage = 1;
        }
      } else {
        pdfState.instance = originalPdfInstance;
      }
    } catch (error) {
      console.error('Error updating PDF:', error);
      toastProps = {
        show: true,
        message: `Error updating PDF: ${error.message}`,
        type: 'error',
      };
    }
  };

  const debouncedUpdatePDF = debounce(updatePDF, 300);

  tocItems.subscribe((items) => {
    if (isFileLoading) return;

    if (!hasShownTocHint && items.length > 0) {
      toastProps = {
        show: true,
        message: `ToC pages will be inserted at page 2.
          This can be changed in Settings.`,
        type: 'success',
      };
      hasShownTocHint = true;
    }

    debouncedUpdatePDF();
  });
  tocConfig.subscribe(() => {
    if (isFileLoading) return;
    debouncedUpdatePDF();
  });

  let previousAddPhysicalTocPage = addPhysicalTocPage;
  $: {
    if (pdfState.doc && previousAddPhysicalTocPage !== addPhysicalTocPage && !isFileLoading) {
      previousAddPhysicalTocPage = addPhysicalTocPage;
      debouncedUpdatePDF();
    }
  }

  const handleFileDrop = async (e: CustomEvent) => {
    const {acceptedFiles} = e.detail;
    isDragging = false;

    if (acceptedFiles.length) {
      isFileLoading = true;
      hasShownTocHint = false;
      const file = acceptedFiles[0];
      pdfState.filename = file.name;

      pdfState.instance = null;
      pdfState.totalPages = 0;
      originalPdfInstance = null;
      previewPdfInstance = null;
      pdfState = {...pdfState};

      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        pdfState.doc = await PDFDocument.load(uint8Array);

        const loadingTask = pdfjsLib.getDocument(uint8Array);

        originalPdfInstance = await loadingTask.promise;
        previewPdfInstance = originalPdfInstance;
        isPreviewMode = false;
        tocPageCount = 0;

        pdfState.currentPage = 1;
        tocStartPage = 1;
        tocEndPage = 1;

        tocItems.set([]);
        updateTocField('pageOffset', 0);
        updateTocField('insertAtPage', 2);
      } catch (error) {
        console.error('Error loading PDF:', error);
        toastProps = {
          show: true,
          message: `Error loading PDF: ${error.message}`,
          type: 'error',
        };
      } finally {
        isFileLoading = false;
        updateViewerInstance();
      }
    }
  };

  const exportPDF = async () => {
    await updatePDF();

    if (!pdfState.newDoc) {
      console.error('No new PDF document to export.');
      toastProps = {
        show: true,
        message: 'Error: No PDF document to export.',
        type: 'error',
      };
      return;
    }

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

      toastProps = {
        show: true,
        message: 'Export Successful!',
        type: 'success',
      };
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toastProps = {
        show: true,
        message: `Error exporting PDF: ${error.message}`,
        type: 'error',
      };
    }
  };

  function buildTree(items: {title: string; level: number; page: number}[]): TocItem[] {
    const root: TocItem[] = [];
    const stack: {node: TocItem; level: number}[] = [];
    let idCounter = 0;

    items.forEach((item) => {
      const newItem: TocItem = {
        id: `ai-${idCounter++}`,
        title: item.title,
        to: item.page,
        children: [],
        open: true,
      };

      const level = item.level;

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(newItem);
      } else {
        const parent = stack[stack.length - 1].node;
        parent.children = parent.children || [];
        parent.children.push(newItem);
      }
      stack.push({node: newItem, level: level});
    });
    return root;
  }

  const generateTocFromAI = async () => {
    if (!originalPdfInstance || !$pdfService) {
      toastProps = {
        show: true,
        message: 'Please load a PDF first.',
        type: 'error',
      };
      return;
    }

    if (tocEndPage < tocStartPage) {
      toastProps = {
        show: true,
        message: 'End page must be greater than or equal to start page.',
        type: 'error',
      };
      return;
    }

    isAiLoading = true;
    aiError = null;
    try {
      const imagesBase64: string[] = [];

      for (let pageNum = tocStartPage; pageNum <= tocEndPage; pageNum++) {
        const image = await $pdfService.getPageAsImage(originalPdfInstance, pageNum, 1.5);
        imagesBase64.push(image);
      }

      const response = await fetch('/api/process-toc', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({images: imagesBase64}),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'AI processing failed.');
      }

      const aiResult: {title: string; level: number; page: number}[] = await response.json();

      if (!aiResult || aiResult.length === 0) {
        aiError = 'AI could not find a valid ToC on these pages.';
        return;
      }

      const nestedTocItems = buildTree(aiResult);

      pendingTocItems = nestedTocItems;
      firstTocItem = nestedTocItems.length > 0 ? nestedTocItems[0] : null;

      if (firstTocItem) {
        offsetPreviewPageNum = firstTocItem.to;
        showOffsetModal = true;
      } else {
        tocItems.set(nestedTocItems);
        pendingTocItems = [];
      }
    } catch (error) {
      console.error('Error generating ToC from AI:', error);
      aiError = `Error: ${error.message}`;
    } finally {
      isAiLoading = false;
    }
  };

  const handleOffsetConfirm = () => {
    if (!firstTocItem) return;

    const labeledPage = firstTocItem.to;
    const physicalPage = offsetPreviewPageNum;
    const offset = physicalPage - labeledPage;

    updateTocField('pageOffset', offset);
    tocItems.set(pendingTocItems);

    showOffsetModal = false;
    pendingTocItems = [];
    firstTocItem = null;
  };

  const renderOffsetPreviewPage = async (pageNum: number) => {
    if (!originalPdfInstance || !$pdfService || !showOffsetModal) return;
    const canvas = document.getElementById('offset-preview-canvas') as HTMLCanvasElement;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      const renderWidth = canvas.clientWidth * dpr;

      if (renderWidth === 0) {
        setTimeout(() => renderOffsetPreviewPage(pageNum), 100);
        return;
      }

      await $pdfService.renderPageToCanvas(originalPdfInstance, pageNum, canvas, renderWidth);

    }
  };

  $: {
    if (
      showOffsetModal &&
      offsetPreviewPageNum > 0 &&
      offsetPreviewPageNum <= (originalPdfInstance?.numPages || 0) &&
      originalPdfInstance &&
      $pdfService
    ) {
      (async () => {
        await tick();
        renderOffsetPreviewPage(offsetPreviewPageNum);
      })();
    }
  }

  const debouncedJumpToPage = debounce((page: number) => {
    if (page > 0 && page <= pdfState.totalPages) {
      pdfState.currentPage = page;
      pdfState = {...pdfState};
    }
  }, 200);

  const handleTocItemHover = (e: CustomEvent) => {
    const logicalPage = e.detail.to as number;
    const physicalContentPage = logicalPage + config.pageOffset;

    let targetPage: number;

    if (isPreviewMode) {
      const insertedPages = addPhysicalTocPage ? tocPageCount : 0;

      if (physicalContentPage >= config.insertAtPage) {
        targetPage = physicalContentPage + insertedPages;
      } else {
        targetPage = physicalContentPage;
      }
    } else {
      targetPage = physicalContentPage;

      isPreviewMode = true;
      updateViewerInstance();

      setTimeout(() => {
        debouncedJumpToPage(targetPage);
      }, 50);

      return;
    }

    if (isPreviewMode) {
      debouncedJumpToPage(targetPage);
    }
  };

  const handleSetStartPage = (e: CustomEvent) => {
    const newStartPage = e.detail.page;
    tocStartPage = newStartPage;
    if (tocEndPage < newStartPage) {
      tocEndPage = newStartPage;
    }
  };

  const handleSetEndPage = (e: CustomEvent) => {
    const newEndPage = e.detail.page;
    if (newEndPage < tocStartPage) {
      tocStartPage = newEndPage;
    }
    tocEndPage = newEndPage;
  };
</script>

{#if toastProps.show}
  <Toast
    message={toastProps.message}
    type={toastProps.type}
    on:close={() => (toastProps.show = false)}
  />
{/if}

<div class="flex mt-8 p-4 gap-8 mx-auto w-[90%] xl:w-[80%] 3xl:w-[75%] font-mono justify-between">
  <div class="w-[30%]">
    <div class="flex items-center gap-6">
      <span class="text-3xl tracking-widest font-semibold">Tocify</span>
      <Logo />
    </div>

    <div class="border-black border-2 rounded-lg p-2 my-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] bg-white">
      <div class="flex justify-between items-center">
        <h2>ToC Settings</h2>
        <button
          class="w-6 h-6 flex items-center justify-center"
          on:click={toggleExpand}
          aria-label="Toggle Expand/Collapse"
        >
          {#if isTocConfigExpanded}
            <Eye class="text-gray-700" />
          {:else}
            <EyeOff class="text-gray-500" />
          {/if}
        </button>
      </div>

      {#if isTocConfigExpanded}
        <div
          class="mt-3"
          transition:slide={{duration: 200}}
        >
          <div class="border-black border-2 rounded-md my-1 p-2 w-full">
            <input
              bind:checked={addPhysicalTocPage}
              type="checkbox"
              id="add_physical_page"
            />
            <label for="add_physical_page">Add physical ToC page</label>
          </div>

          {#if addPhysicalTocPage}
            <div class="border-black border-2 rounded-md my-2 p-2 w-full">
              <div class="flex gap-2 items-center">
                <label
                  class="whitespace-nowrap text-sm"
                  for="insert_at_page">Insert Before Page #</label
                >
                <input
                  type="number"
                  id="insert_at_page"
                  value={config.insertAtPage || 2}
                  on:input={(e) => updateTocField('insertAtPage', parseInt(e.target.value, 10) || 2)}
                  class="w-20 border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={1}
                />
              </div>
              <div class="text-xs text-gray-500 mt-1">(1-based, 1 = first page)</div>
            </div>
          {/if}

          <div class="border-black border-2 rounded-md my-1 p-2 w-full">
            <input
              bind:checked={config.showNumberedList}
              type="checkbox"
              id="show_numbered_list"
              on:change={(e) => updateTocField('showNumberedList', e.target.checked)}
            />
            <label for="show_numbered_list">with numbered list</label>
          </div>

          <div class="border-black border-2 rounded-md my-2 p-2 w-full">
            <div class="flex gap-2 items-center">
              <label
                class="whitespace-nowrap text-sm"
                for="page_offset">Page Numbering Offset</label
              >
              <input
                type="number"
                id="page_offset"
                bind:value={config.pageOffset}
                on:input={(e) => updateTocField('pageOffset', parseInt(e.target.value, 10) || 0)}
                class="w-20 border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div class="text-xs text-gray-500 mt-1">(Physical Page #) - (Labeled Page #)</div>
          </div>
          <div class="flex gap-4">
            <div class="w-1/2">
              <h3 class="my-4 font-bold">First Level</h3>

              <div class="border-black border-2 rounded-md my-3 p-2 w-full">
                <label for="first_level_font_size">Font Size</label>
                <input
                  type="number"
                  id="first_level_font_size"
                  bind:value={config.firstLevel.fontSize}
                  on:input={(e) => updateTocField('firstLevel.fontSize', parseInt(e.target.value, 10) || 0)}
                  class="w-[80%] border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="border-black border-2 rounded-md my-3 p-2 w-full">
                <label for="first_level_dot_leader">Dot Leader</label>
                <input
                  type="text"
                  id="first_level_dot_leader"
                  bind:value={config.firstLevel.dotLeader}
                  on:input={(e) => updateTocField('firstLevel.dotLeader', e.target.value)}
                  class="w-[80%] border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="border-black border-2 rounded-md my-3 p-2 w-full">
                <label for="first_level_color">Color</label>
                <input
                  type="color"
                  id="first_level_color"
                  bind:value={config.firstLevel.color}
                  on:input={(e) => updateTocField('firstLevel.color', e.target.value)}
                  class="w-[80%]"
                />
              </div>

              <div class="border-black border-2 rounded-md my-3 p-2 w-full">
                <label for="first_level_line_spacing">Spacing</label>
                <input
                  type="number"
                  step="0.1"
                  id="first_level_line_spacing"
                  bind:value={config.firstLevel.lineSpacing}
                  on:input={(e) => updateTocField('firstLevel.lineSpacing', parseFloat(e.target.value) || 1)}
                  class="w-[80%] border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div class="w-1/2">
              <h3 class="my-4 font-bold">Other Levels</h3>

              <div class="border-black border-2 rounded-md my-3 p-2 w-full">
                <label for="other_levels_font_size">Font Size</label>
                <input
                  type="number"
                  id="other_levels_font_size"
                  bind:value={config.otherLevels.fontSize}
                  on:input={(e) => updateTocField('otherLevels.fontSize', parseInt(e.target.value, 10) || 0)}
                  class="w-[80%] border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="border-black border-2 rounded-md my-3 p-2 w-full">
                <label for="other_levels_dot_leader">Dot Leader</label>
                <input
                  type="text"
                  id="other_levels_dot_leader"
                  bind:value={config.otherLevels.dotLeader}
                  on:input={(e) => updateTocField('otherLevels.dotLeader', e.target.value)}
                  class="w-[80%] border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="border-black border-2 rounded-md my-3 p-2 w-full">
                <label for="other_levels_color">Color</label>
                <input
                  type="color"
                  id="other_levels_color"
                  bind:value={config.otherLevels.color}
                  on:input={(e) => updateTocField('otherLevels.color', e.target.value)}
                  class="w-[80%]"
                />
              </div>

              <div class="border-black border-2 rounded-md my-3 p-2 w-full">
                <label for="other_levels_line_spacing">Spacing</label>
                <input
                  type="number"
                  step="0.1"
                  id="other_levels_line_spacing"
                  bind:value={config.otherLevels.lineSpacing}
                  on:input={(e) => updateTocField('otherLevels.lineSpacing', parseFloat(e.target.value) || 1)}
                  class="w-[80%] border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
    {#if originalPdfInstance}
      <div transition:fade={{duration: 200}}>
        <div class="border-black border-2 rounded-lg p-3 my-4 bg-blue-100 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <h3 class="font-bold mb-2">ToC Pages Selection</h3>
          <p class="text-sm text-gray-600 mb-3">
            {#if !isSettingStart}
              Click the grid to select the End Page including ToCs
            {:else}
              Click the grid to select the Start Page including ToCs
            {/if}
          </p>

          <div class="flex gap-4 items-center my-2">
            <label
              for="toc_start_page"
              class="w-32">Start Page:</label
            >
            <input
              type="number"
              id="toc_start_page"
              bind:value={tocStartPage}
              min={1}
              max={pdfState.totalPages}
              class="border-2 border-black rounded px-2 py-1 w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="flex gap-4 items-center my-2">
            <label
              for="toc_end_page"
              class="w-32">End Page:</label
            >
            <input
              type="number"
              id="toc_end_page"
              bind:value={tocEndPage}
              min={tocStartPage}
              max={pdfState.totalPages}
              class="border-2 border-black rounded px-2 py-1 w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    {/if}

    <button
      class="btn w-full my-2 font-bold bg-blue-500 text-black border-2 border-black rounded-lg px-4 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all disabled:bg-gray-300 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
      on:click={generateTocFromAI}
      disabled={isAiLoading || !originalPdfInstance}
    >
      {#if isAiLoading}
        <span>Generating...</span>
      {:else}
        <span>✨ Generate ToC from Pages (AI)</span>
      {/if}
    </button>

    {#if aiError}
      <div class="my-2 p-3 bg-red-100 border-2 border-red-700 text-red-700 rounded-lg">
        {aiError}
      </div>
    {/if}

    <TocEditor
      on:hoveritem={handleTocItemHover}
      currentPage={pdfState.currentPage}
      isPreview={isPreviewMode}
      pageOffset={config.pageOffset}
      insertAtPage={config.insertAtPage}
      tocPageCount={addPhysicalTocPage ? tocPageCount : 0}
    />
  </div>

  <div class="flex flex-col w-[70%]">
    <div
      class="h-fit pb-4 min-h-[85vh] top-5 sticky border-black border-2 rounded-lg relative bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)]"
    >
      <Dropzone
        containerClasses="absolute inset-0 w-full h-full"
        accept=".pdf"
        disableDefaultStyles
        on:drop={handleFileDrop}
        on:dragenter={() => (isDragging = true)}
        on:dragleave={() => (isDragging = false)}
      >
        <div
          class="w-full h-full rounded-lg text-center cursor-pointer transition-colors duration-200
            {pdfState.instance ? 'pointer-events-none' : ''} "
          class:pointer-events-auto={isDragging}
          class:bg-blue-200={isDragging}
          class:bg-opacity-80={isDragging}
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
        <div class="relative z-10 h-full flex flex-col">
          <PDFViewer
            bind:pdfState
            mode={isPreviewMode ? 'single' : 'grid'}
            {tocStartPage}
            {tocEndPage}
            bind:isSettingStart
            on:setstartpage={handleSetStartPage}
            on:setendpage={handleSetEndPage}
          />

          <div class="flex gap-2 justify-end pt-4 relative z-10 mr-3">
            <button
              class="btn flex gap-2 items-center font-bold bg-yellow-400 text-black border-2 border-black rounded-lg px-4 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all disabled:bg-gray-300 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
              on:click={togglePreviewMode}
              disabled={!previewPdfInstance || previewPdfInstance === originalPdfInstance}
              title={isPreviewMode
                ? 'Switch to Edit Mode (Show Original PDF)'
                : 'Switch to Preview Mode (Show Generated PDF)'}
            >
              {#if isPreviewMode}
                <PencilIcon size={16} />
                Edit (Grid View)
              {:else}
                <EyeIcon size={16} />
                Preview (Single View)
              {/if}
            </button>

            <button
              class="btn font-bold bg-green-500 text-black border-2 border-black rounded-lg px-4 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all disabled:bg-gray-300 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
              on:click={exportPDF}
              disabled={!pdfState.doc}
            >
              Generate Outlined PDF
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if isAiLoading}
  <div
    class="fixed inset-0 flex flex-col items-center justify-center z-50 font-mono bg-yellow-400"
    transition:fade={{duration: 200}}
  >
    <div
      class="bg-white p-8 sm:p-12 border-4 border-black rounded-lg shadow-[8px_8px_0px_rgba(0,0,0,1)] flex flex-col items-center gap-6 w-11/12 max-w-md"
    >
      <div class="text-xl text-center font-bold text-black">
        <span>Extracting ToCs From Pages {tocStartPage} to {tocEndPage}...</span>
        <br />
        <br />
        <span>This may take minutes</span>
      </div>
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent"></div>
    </div>
  </div>
{/if}

{#if showOffsetModal && firstTocItem}
  <div
    class="fixed inset-0 bg-lime-400 flex items-center justify-center z-50 p-4"
    transition:fade={{duration: 150}}
    on:click={() => (showOffsetModal = false)}
  >
    <div
      class="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)]"
      transition:fly={{y: 20, duration: 200}}
      on:click|stopPropagation
    >
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold">Confirm Page Offset By The First ToC Item</h2>
        <button
          on:click={() => (showOffsetModal = false)}
          class="p-1 rounded-full text-black hover:bg-black hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X size={24} />
        </button>
      </div>

      <div class="flex flex-col md:flex-row gap-6">
        <div class="w-full md:w-1/3 flex flex-col text-xl">
          <p class="my-4 text-gray-700">
            We found
            <strong class="text-black text-3xl block my-2">{firstTocItem?.title}</strong>

            on

            <strong class="text-black text-3xl block my-2">Page {firstTocItem?.to} </strong>
          </p>

          <p class="my-4 text-gray-700">Select the physical page where this section actually begins</p>

          <div class="flex gap-4 items-center my-4">
            <label
              for="physical_page_select"
              class="font-semibold">Physical Page:</label
            >
            <div class="flex items-center gap-2">
              <button
                class="btn p-2 h-10 w-10 font-bold bg-white text-black border-2 border-black rounded-lg shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:bg-gray-200 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
                on:click={() => {
                  if (offsetPreviewPageNum > 1) offsetPreviewPageNum--;
                }}
                disabled={offsetPreviewPageNum <= 1}
              >
                -
              </button>

              <input
                type="number"
                id="physical_page_select"
                bind:value={offsetPreviewPageNum}
                min={1}
                max={pdfState.totalPages}
                class="border-2 border-black rounded px-2 py-1 w-20 h-10 text-center font-bold text-2xl [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />

              <button
                class="btn p-2 h-10 w-10 font-bold bg-white text-black border-2 border-black rounded-lg shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:bg-gray-200 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
                on:click={() => {
                  if (offsetPreviewPageNum < pdfState.totalPages)
                    offsetPreviewPageNum++;
                }}
                disabled={offsetPreviewPageNum >= pdfState.totalPages}
              >
                +
              </button>
            </div>
          </div>

          <button
            on:click={handleOffsetConfirm}
            class="btn mt-auto font-bold bg-blue-500 text-black border-2 border-black rounded-lg px-4 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all w-full"
          >
          Yes! This page !
          </button>
        </div>

        <div class="w-full md:w-2/3">
          <div class="border-2 border-black rounded-lg overflow-hidden bg-gray-50 h-[75vh]">
            <canvas
              id="offset-preview-canvas"
              class="w-full h-full"
            ></canvas>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<svelte:head>
  <title>Tocify · Add or edit PDF Table of Contents in browser</title>
</svelte:head>
