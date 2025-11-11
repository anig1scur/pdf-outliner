<script lang="ts">
  import { onMount, tick } from 'svelte'; 
  import * as pdfjsLib from 'pdfjs-dist';
  import Dropzone from 'svelte-file-dropzone';
  import { PDFDocument } from 'pdf-lib';
  import { Eye, EyeOff, X, EyeIcon, PencilIcon } from 'lucide-svelte';

  import TocEditor from '../components/TocEditor.svelte';
  import PDFViewer from '../components/PDFViewer.svelte';
  import Logo from '../assets/logo-dark.svelte';
  import Toast from '../components/Toast.svelte';

  import { setOutline } from '../lib/pdf-outliner';
  import { PDFService, type PDFState, type TocItem } from '../lib/pdf-service';
  import { tocItems, pdfService, type TocConfig } from '../stores';
  import { debounce } from '../lib';
  import { tocConfig } from '../stores';

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

  let originalPdfInstance: pdfjsLib.PDFDocumentProxy | null = null;
  let previewPdfInstance: pdfjsLib.PDFDocumentProxy | null = null;
  let tocPageCount = 0;
  let isPreviewMode = false; // false = 'grid' (编辑), true = 'single' (预览)

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
      $pdfService.renderPage(
        pdfState.instance,
        pdfState.currentPage,
        pdfState.scale
      );
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
    pdfState = { ...pdfState };
  };

  const togglePreviewMode = () => {
    if (!previewPdfInstance) {
      toastProps = { show: true, message: 'Please edit the ToC first to generate a preview.', type: 'error' };
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

      const { newDoc, tocPageCount: count } = await $pdfService.createTocPage(
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

  tocItems.subscribe(() => {
    if (isFileLoading) return;
    debouncedUpdatePDF();
  });
  tocConfig.subscribe(() => {
    if (isFileLoading) return;
    debouncedUpdatePDF();
  });

  let previousAddPhysicalTocPage = addPhysicalTocPage;
  $: {
    if (
      pdfState.doc &&
      previousAddPhysicalTocPage !== addPhysicalTocPage &&
      !isFileLoading
    ) {
      previousAddPhysicalTocPage = addPhysicalTocPage;
      debouncedUpdatePDF();
    }
  }

  const handleFileDrop = async (e: CustomEvent) => {
    const { acceptedFiles } = e.detail;
    isDragging = false;

    if (acceptedFiles.length) {
      isFileLoading = true;
      const file = acceptedFiles[0];
      pdfState.filename = file.name;

      pdfState.instance = null;
      pdfState.totalPages = 0;
      originalPdfInstance = null;
      previewPdfInstance = null;
      pdfState = { ...pdfState }; 

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
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
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

  function buildTree(
    items: { title: string; level: number; page: number }[]
  ): TocItem[] {
    const root: TocItem[] = [];
    const stack: { node: TocItem; level: number }[] = [];
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
      stack.push({ node: newItem, level: level });
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
        const image = await $pdfService.getPageAsImage(
          originalPdfInstance,
          pageNum,
          1.5
        );
        imagesBase64.push(image);
      }

      const response = await fetch('/api/process-toc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imagesBase64 }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'AI processing failed.');
      }

      const aiResult: { title: string; level: number; page: number }[] =
        await response.json();

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
    const canvas = document.getElementById(
      'offset-preview-canvas'
    ) as HTMLCanvasElement;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      const renderWidth = canvas.clientWidth * dpr;

      if (renderWidth === 0) {
        setTimeout(() => renderOffsetPreviewPage(pageNum), 100);
        return;
      }

      await $pdfService.renderPageToCanvas(
        originalPdfInstance,
        pageNum,
        canvas,
        renderWidth 
      );
      canvas.style.width = "100%";
      canvas.style.height = "auto";
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
      pdfState = { ...pdfState }; 
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

<div class="flex mt-8 p-4 gap-12 mx-auto w-[80%] font-mono justify-between">
  <div>
    <div class="flex items-center gap-6">
      <span class="text-3xl font-semibold">Tocify</span>
      <Logo />
    </div>

    
    <div class="border-dashed border-gray-100 rounded border-2 p-2 my-4">
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
        <div class="mt-3">
          <div class="border-dashed border-gray-100 rounded border-2 my-1 p-2 w-72">
            <input
              bind:checked={addPhysicalTocPage}
              type="checkbox"
              id="add_physical_page"
            />
            <label for="add_physical_page">Add physical ToC page</label>
          </div>

          {#if addPhysicalTocPage}
          <div class="border-dashed border-gray-100 rounded border-2 my-2 p-2 w-72">
            <div class="flex gap-2 items-center">
              <label class="whitespace-nowrap text-sm" for="insert_at_page"
                >Insert Before Page #</label
              >
              <input
                type="number"
                id="insert_at_page"
                value={config.insertAtPage || 2}
                on:input={(e) => updateTocField('insertAtPage', parseInt(e.target.value, 10) || 2)}
                class="w-20 border rounded px-1"
                min={1}
              />
            </div>
            <div class="text-xs text-gray-500 mt-1">
              (1-based, 1 = first page)
            </div>
          </div>
          {/if}

          <div class="border-dashed border-gray-100 rounded border-2 my-1 p-2 w-72">
            <input
              bind:checked={config.showNumberedList}
              type="checkbox"
              id="show_numbered_list"
              on:change={(e) => updateTocField('showNumberedList', e.target.checked)}
            />
            <label for="show_numbered_list">with numbered list</label>
          </div>

          <div class="border-dashed border-gray-100 rounded border-2 my-2 p-2 w-72">
            <div class="flex gap-2 items-center">
              <label class="whitespace-nowrap text-sm" for="page_offset"
                >Page Numbering Offset</label
              >
              <input
                type="number"
                id="page_offset"
                bind:value={config.pageOffset}
                on:input={(e) => updateTocField('pageOffset', parseInt(e.target.value, 10) || 0)}
                class="w-20 border rounded px-1"
              />
            </div>
            <div class="text-xs text-gray-500 mt-1">
              (Physical Page #) - (Labeled Page #)
            </div>
          </div>
          <div class="flex">
            <div class="w-36 inline-block mr-3">
              <h3 class="my-4 font-bold">First Level</h3>

              <div class="border-dashed border-gray-100 rounded border-2 my-3 p-2 mr-2 w-32">
                <label for="first_level_font_size">Font Size</label>
                <input
                  type="number"
                  id="first_level_font_size"
                  bind:value={config.firstLevel.fontSize}
                  on:input={(e) => updateTocField('firstLevel.fontSize', parseInt(e.target.value, 10) || 0)}
                  class="w-[80%]"
                />
              </div>

              <div class="border-dashed border-gray-100 rounded border-2 my-3 p-2 mr-2 w-32">
                <label for="first_level_dot_leader">Dot Leader</label>
                <input
                  type="text"
                  id="first_level_dot_leader"
                  bind:value={config.firstLevel.dotLeader}
                  on:input={(e) => updateTocField('firstLevel.dotLeader', e.target.value)}
                  class="w-[80%]"
                />
              </div>

              <div class="border-dashed border-gray-100 rounded border-2 my-3 p-2 mr-2 w-32">
                <label for="first_level_color">Color</label>
                <input
                  type="color"
                  id="first_level_color"
                  bind:value={config.firstLevel.color}
                  on:input={(e) => updateTocField('firstLevel.color', e.target.value)}
                  class="w-[80%]"
                />
              </div>

              <div class="border-dashed border-gray-100 rounded border-2 my-3 p-2 mr-2 w-32">
                <label for="first_level_line_spacing">Spacing</label>
                <input
                  type="number"
                  step="0.1"
                  id="first_level_line_spacing"
                  bind:value={config.firstLevel.lineSpacing}
                  on:input={(e) => updateTocField('firstLevel.lineSpacing', parseFloat(e.target.value) || 1)}
                  class="w-[80%]"
                />
              </div>
            </div>

            <div class="w-36 inline-block">
              <h3 class="my-4 font-bold">Other Levels</h3>

              <div class="border-dashed border-gray-100 rounded border-2 my-3 p-2">
                <label for="other_levels_font_size">Font Size</label>
                <input
                  type="number"
                  id="other_levels_font_size"
                  bind:value={config.otherLevels.fontSize}
                  on:input={(e) => updateTocField('otherLevels.fontSize', parseInt(e.target.value, 10) || 0)}
                  class="w-[80%]"
                />
              </div>

              <div class="border-dashed border-gray-100 rounded border-2 my-3 p-2">
                <label for="other_levels_dot_leader">Dot Leader</label>
                <input
                  type="text"
                  id="other_levels_dot_leader"
                  bind:value={config.otherLevels.dotLeader}
                  on:input={(e) => updateTocField('otherLevels.dotLeader', e.target.value)}
                  class="w-[80%]"
                />
              </div>

              <div class="border-dashed border-gray-100 rounded border-2 my-3 p-2">
                <label for="other_levels_color">Color</label>
                <input
                  type="color"
                  id="other_levels_color"
                  bind:value={config.otherLevels.color}
                  on:input={(e) => updateTocField('otherLevels.color', e.target.value)}
                  class="w-[80%]"
                />
              </div>

              <div class="border-dashed border-gray-100 rounded border-2 my-3 p-2">
                <label for="other_levels_line_spacing">Spacing</label>
                <input
                  type="number"
                  step="0.1"
                  id="other_levels_line_spacing"
                  bind:value={config.otherLevels.lineSpacing}
                  on:input={(e) => updateTocField('otherLevels.lineSpacing', parseFloat(e.target.value) || 1)}
                  class="w-[80%]"
                />
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="border-dashed border-blue-100 rounded border-2 p-3 my-4">
      <h3 class="font-bold mb-2">ToC Pages Selection</h3>
      <p class="text-sm text-gray-600 mb-3">
        {#if !isSettingStart}
          Click on the grid to select the <strong>End Page</strong>...
        {:else}
          Click on the grid to select the <strong>Start Page</strong>...
        {/if}
      </p>

      <div class="flex gap-4 items-center my-2">
        <label for="toc_start_page" class="w-32">Start Page:</label>
        <input
          type="number"
          id="toc_start_page"
          bind:value={tocStartPage}
          min={1}
          max={pdfState.totalPages}
          class="border rounded px-2 py-1 w-20"
        />
      </div>

      <div class="flex gap-4 items-center my-2">
        <label for="toc_end_page" class="w-32">End Page:</label>
        <input
          type="number"
          id="toc_end_page"
          bind:value={tocEndPage}
          min={tocStartPage}
          max={pdfState.totalPages}
          class="border rounded px-2 py-1 w-20"
        />
      </div>

      <!-- REMOVED: "Preview Selected Pages" 按钮 -->
    </div>

    <button
      class="btn w-full my-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
      on:click={generateTocFromAI}
      disabled={isAiLoading || !originalPdfInstance} >
      {#if isAiLoading}
        <span>Analyzing Pages {tocStartPage} to {tocEndPage}...</span>
      {:else}
        <span>✨ Generate ToC from Pages (AI)</span>
      {/if}
    </button>

    {#if aiError}
      <div
        class="my-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded"
      >
        {aiError}
      </div>
    {/if}

    <TocEditor on:hoveritem={handleTocItemHover} />
  </div>

  <div class="flex flex-col flex-1">
    <!-- 容器现在是粘性的 -->
    <div class="h-fit pb-8 min-h-[85vh] top-5 sticky">
      <Dropzone
        containerClasses={pdfState.instance ? '' : 'h-full'}
        accept=".pdf"
        disableDefaultStyles
        on:drop={handleFileDrop}
        on:dragenter={() => (isDragging = true)}
        on:dragleave={() => (isDragging = false)}
      >
        <div
          class="max-w-5xl w-full absolute inset-0 p-8 border-2 border-gray-100 border-dashed rounded-lg text-center cursor-pointer transition-colors duration-200 {pdfState.instance
            ? 'bg-transparent hover:bg-white/50'
            : ''}"
          class:border-blue-500={isDragging}
          class:bg-blue-50={isDragging}
        >
          {#if !pdfState.instance || isDragging}
            <div
              class="absolute text-stone-500 inset-0 flex items-center justify-center"
            >
              <p class="px-2">
                {isDragging
                  ? 'Drop your PDF file here...'
                  : 'Drag and drop your PDF file here, or click to select'}
              </p>
            </div>
          {/if}
        </div>
      </Dropzone>

      {#if pdfState.instance}
        <!-- 
          按钮已从此位置移除
        -->

        <PDFViewer
          bind:pdfState
          mode={isPreviewMode ? 'single' : 'grid'}
          tocStartPage={tocStartPage}
          tocEndPage={tocEndPage}
          bind:isSettingStart={isSettingStart} 
          on:setstartpage={handleSetStartPage}
          on:setendpage={handleSetEndPage}
        />

        <!-- 
          按钮的新位置: 
          位于 PDFViewer 之后, 在粘性容器的底部
        -->
        <div class="flex gap-2 justify-end mt-4 px-4 relative z-10">
          <button
            class="btn flex gap-2 items-center"
            on:click={togglePreviewMode}
            disabled={!previewPdfInstance || previewPdfInstance === originalPdfInstance}
            title={isPreviewMode ? "Switch to Edit Mode (Show Original PDF)" : "Switch to Preview Mode (Show Generated PDF)"}
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
            class="btn bg-green-600 text-white hover:bg-green-700"
            on:click={exportPDF}
            disabled={!pdfState.doc}
          >
            Generate Outlined PDF
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- REMOVED: showPreview 弹窗 -->

{#if showOffsetModal && firstTocItem}
<div
class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
on:click={() => (showOffsetModal = false)}
>
<div
  class="bg-white rounded-lg p-6 max-w-lg w-full"
  on:click|stopPropagation
>
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">Confirm Page Offset</h2>
    <button
      on:click={() => (showOffsetModal = false)}
      class="text-gray-500 hover:text-gray-700"
    >
      <X size={24} />
    </button>
  </div>

  <p class="my-4 text-gray-700">
    AI found:
    <strong class="text-black">'{firstTocItem.title}'</strong>
    on
    <strong class="text-black">Page {firstTocItem.to}</strong>.
  </p>
  <p class="mb-2 text-gray-700">
    Please select the
    <strong>actual physical page</strong>
    where this section begins. Use the preview to confirm.
  </p>

  <div class="flex gap-4 items-center my-4">
    <label for="physical_page_select" class="font-semibold">Physical Page:</label>
    <input
      type="number"
      id="physical_page_select"
      bind:value={offsetPreviewPageNum}
      min={1}
      max={pdfState.totalPages}
      class="border rounded px-2 py-1 w-20"
    />
  </div>

  <div class="my-4 border rounded overflow-hidden bg-gray-50">
    <canvas id="offset-preview-canvas" class="w-full"></canvas>
  </div>

  <button
    on:click={handleOffsetConfirm}
    class="btn bg-blue-600 text-white w-full hover:bg-blue-700"
  >
    Confirm Offset & Apply ToC
  </button>
</div>
</div>
  {/if}


<svelte:head>
  <title>
    Tocify · Add or edit PDF Table of Contents in browser based on AI
  </title>
</svelte:head>