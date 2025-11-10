<script lang="ts">
  import {onMount} from 'svelte';
  import * as pdfjsLib from 'pdfjs-dist';
  import Dropzone from 'svelte-file-dropzone';
  import {PDFDocument} from 'pdf-lib';
  import {Eye, EyeOff, X} from 'lucide-svelte';

  import TocEditor from '../components/TocEditor.svelte';
  import PDFViewer from '../components/PDFViewer.svelte';
  import Logo from '../assets/logo-dark.svelte';

  import {setOutline} from '../lib/pdf-outliner';
  import {PDFService, type PDFState, type TocItem} from '../lib/pdf-service';
  import {tocItems, pdfService, type TocConfig} from '../stores';
  import {debounce} from '../lib';
  import {tocConfig} from '../stores';

  let isTocConfigExpanded = false;
  let showPreview = false;
  let addPhysicalTocPage = true;

  // New Modal State
  let showOffsetModal = false;
  let pendingTocItems: TocItem[] = [];
  let firstTocItem: TocItem | null = null;
  let offsetPreviewPageNum = 1;

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

  let pdfState: PDFState = {
    doc: null,
    newDoc: null,
    instance: null,
    filename: '',
    currentPage: 1,
    totalPages: 0,
    scale: 1.0,
  };

  // 移除 `$: tocPagesCount` 

  onMount(() => {
    $pdfService = new PDFService();
  });

  $: {
    if (pdfState.instance && pdfState.currentPage && $pdfService) {
      $pdfService.renderPage(pdfState.instance, pdfState.currentPage, pdfState.scale);
    }
  }

  const updatePDF = async () => {
    if (!pdfState.doc || !$pdfService) return;

    try {
      const currentPageBackup = pdfState.currentPage;

      // 传递所有配置, 包括新的 insertAtPage
      const { newDoc, tocPageCount } = await $pdfService.createTocPage(
        pdfState.doc,
        $tocItems,
        addPhysicalTocPage,
        config.insertAtPage // 新增
      );

      // 你必须修改 setOutline 来接受第5个参数
      setOutline(
        newDoc, 
        $tocItems, 
        config.pageOffset, 
        tocPageCount, 
        config.insertAtPage // 新增
      );

      const pdfBytes = await newDoc.save();
      const loadingTask = pdfjsLib.getDocument(pdfBytes);
      pdfState.instance = await loadingTask.promise;
      pdfState.totalPages = pdfState.instance.numPages;

      if (currentPageBackup <= pdfState.totalPages) {
        pdfState.currentPage = currentPageBackup;
      } else {
        pdfState.currentPage = 1;
      }

      await $pdfService.renderPage(pdfState.instance, pdfState.currentPage, pdfState.scale);

      pdfState.newDoc = newDoc;
    } catch (error) {
      console.error('Error updating PDF:', error);
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
      const file = acceptedFiles[0];
      pdfState.filename = file.name;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        pdfState.doc = await PDFDocument.load(uint8Array);

        const loadingTask = pdfjsLib.getDocument(uint8Array);
        pdfState.instance = await loadingTask.promise;
        pdfState.totalPages = pdfState.instance.numPages;
        pdfState.currentPage = 1;
        tocStartPage = 1;
        tocEndPage = 1;

        tocItems.set([]);
        updateTocField('pageOffset', 0);
        updateTocField('insertAtPage', 1); // 重置插入点

      } catch (error) {
        console.error('Error loading PDF:', error);
      } finally {
        isFileLoading = false;
        if (pdfState.instance && $pdfService) {
           await $pdfService.renderPage(pdfState.instance, pdfState.currentPage, pdfState.scale);
        }
      }
    }
  };

  const exportPDF = async () => {
    await updatePDF();
    
    if (!pdfState.newDoc) {
      console.error('No new PDF document to export.');
      return;
    }
    console.log("Exporting PDF...");

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

  function buildTree(items: { title: string; level: number; page: number }[]): TocItem[] {
    const root: TocItem[] = [];
    const stack: { node: TocItem; level: number }[] = [];
    let idCounter = 0;

    items.forEach(item => {
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
    if (!pdfState.instance || !$pdfService) {
      alert('Please load a PDF first.');
      return;
    }

    if (tocEndPage < tocStartPage) {
      alert('End page must be greater than or equal to start page.');
      return;
    }

    isAiLoading = true;
    try {
      const imagesBase64: string[] = [];

      for (let pageNum = tocStartPage; pageNum <= tocEndPage; pageNum++) {
        const image = await $pdfService.getPageAsImage(
          pdfState.instance,
          pageNum,
          1.5
        );
        imagesBase64.push(image);
      }

      const response = await fetch('/api/process-toc', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ images: imagesBase64 }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'AI processing failed.');
      }

      const aiResult: { title: string; level: number; page: number }[] = await response.json();

      if (!aiResult || aiResult.length === 0) {
        alert('AI could not find a Table of Contents on these pages.');
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
      alert(`Error: ${error.message}`);
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
    if (!pdfState.instance || !$pdfService || !showOffsetModal) return;
    const canvas = document.getElementById('offset-preview-canvas') as HTMLCanvasElement;
    if (canvas) {
      await $pdfService.renderPageToCanvas(pdfState.instance, pageNum, canvas, 400); 
    }
  };

  $: {
    if (showOffsetModal && offsetPreviewPageNum > 0 && offsetPreviewPageNum <= pdfState.totalPages && pdfState.instance && $pdfService) {
      renderOffsetPreviewPage(offsetPreviewPageNum);
    }
  }

  const openPreview = async () => {
    showPreview = true;
    await new Promise(resolve => setTimeout(resolve, 50)); 
    renderPreviewPages();
  };

  const renderPreviewPages = async () => {
    if (!pdfState.instance || !$pdfService) return;

    for (let i = tocStartPage; i <= tocEndPage; i++) {
      const canvas = document.getElementById(`preview-canvas-${i}`) as HTMLCanvasElement;
      if (canvas) {
        await $pdfService.renderPageToCanvas(pdfState.instance, i, canvas, 150);
      }
    }
  };

  $: previewPages = Array.from(
    {length: tocEndPage - tocStartPage + 1},
    (_, i) => tocStartPage + i
  );
</script>

<div class="flex mt-8 p-4 gap-12 mx-auto w-[80%] font-mono justify-between">
  <div>
    <div class="flex items-center gap-6">
      <span class="text-3xl font-semibold">PDF Outliner</span>
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
                value={config.insertAtPage || 1}
                on:input={(e) => updateTocField('insertAtPage', parseInt(e.target.value, 10) || 1)}
                class="w-20 border rounded px-1"
                min={1}
              />
            </div>
            <div class="text-xs text-gray-500 mt-1">
              (1-based, 1 = at start)
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

      <button
        class="btn w-full my-2 bg-green-600 text-white hover:bg-green-700 text-sm"
        on:click={openPreview}
        disabled={!pdfState.instance}
      >
        👁️ Preview Selected Pages ({tocEndPage - tocStartPage + 1} pages)
      </button>
    </div>

    <button
      class="btn w-full my-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
      on:click={generateTocFromAI}
      disabled={isAiLoading || !pdfState.instance}
    >
      {#if isAiLoading}
        <span>Analyzing Pages {tocStartPage} to {tocEndPage}...</span>
      {:else}
        <span>✨ Generate ToC from Pages (AI)</span>
      {/if}
    </button>

    <TocEditor />
  </div>

  <div class="flex flex-col flex-1">
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
        <button
          class="absolute top-3 right-3 z-20 btn"
          on:click={exportPDF}
          disabled={!pdfState.doc}
        >
          Generate Outlined PDF
        </button>
        <PDFViewer bind:pdfState />
      {/if}
    </div>
  </div>
</div>

{#if showPreview}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    on:click={() => (showPreview = false)}
  >
    <div
      class="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto"
      on:click|stopPropagation
    >
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">
          ToC Pages Preview (Pages {tocStartPage} - {tocEndPage})
        </h2>
        <button
          on:click={() => (showPreview = false)}
          class="text-gray-500 hover:text-gray-700"
        >
          <X size={24} />
        </button>
      </div>

      <div class="grid grid-cols-3 gap-4">
        {#each previewPages as pageNum}
          <div class="border rounded p-2">
            <div class="text-center text-sm font-semibold mb-2">
              Page {pageNum}
            </div>
            <canvas
              id="preview-canvas-{pageNum}"
              class="border w-full"
            ></canvas>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

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
    PDF OUTLINER · Add or edit PDF Outlines / Table of Contents in browser
  </title>
</svelte:head>