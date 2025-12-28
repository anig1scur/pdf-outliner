<script lang="ts">
  import {onMount, tick} from 'svelte';
  import {slide, fade, fly} from 'svelte/transition';
  import {t, isLoading} from 'svelte-i18n';
  import {injectAnalytics} from '@vercel/analytics/sveltekit';
  import Dropzone from 'svelte-file-dropzone';
  import type * as PdfjsLibTypes from 'pdfjs-dist';

  import '../lib/i18n';
  import {pdfService, tocItems, curFileFingerprint, tocConfig, type TocConfig} from '../stores';
  import {PDFService, type PDFState, type TocItem} from '../lib/pdf-service';
  import {setOutline} from '../lib/pdf-outliner';
  import {debounce} from '../lib';

  import Header from '../components/Header.svelte';
  import Toast from '../components/Toast.svelte';
  import DropzoneView from '../components/DropzoneView.svelte';

  import PDFViewer from '../components/PDFViewer.svelte';
  import PdfControls from '../components/PdfControls.svelte';
  import TocEditor from '../components/TocEditor.svelte';
  import TocSettings from '../components/TocSetting.svelte';
  import ApiSetting from '../components/ApiSetting.svelte';
  import AiPageSelector from '../components/PageSelector.svelte';
  import Footer from '../components/Footer.svelte';

  import AiLoadingModal from '../components/modals/AiLoadingModal.svelte';
  import OffsetModal from '../components/modals/OffsetModal.svelte';
  import HelpModal from '../components/modals/HelpModal.svelte';

  injectAnalytics();

  let pdfjs: typeof PdfjsLibTypes | null = null;
  let PdfLib: typeof import('pdf-lib') | null = null;
  let fileInputRef: HTMLInputElement;

  let isDragging = false;
  let isFileLoading = false;
  let isAiLoading = false;
  let isPreviewLoading = false;
  let isTocConfigExpanded = false;
  let showNextStepHint = false;
  let hasShownTocHint = false;

  let showOffsetModal = false;
  let showHelpModal = false;
  let offsetPreviewPageNum = 1;
  const videoUrl = '/videos/demo.mp4';
  let toastProps = {
    show: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info',
  };

  let originalPdfInstance: PdfjsLibTypes.PDFDocumentProxy | null = null;
  let previewPdfInstance: PdfjsLibTypes.PDFDocumentProxy | null = null;
  let pdfState: PDFState = {
    doc: null,
    newDoc: null,
    instance: null,
    filename: '',
    currentPage: 1,
    totalPages: 0,
    scale: 1.0,
  };

  let tocStartPage = 1;
  let tocEndPage = 1;
  let tocPageCount = 0;
  let addPhysicalTocPage = false;
  let isPreviewMode = false;
  let pendingTocItems: TocItem[] = [];
  let firstTocItem: TocItem | null = null;
  let aiError: string | null = null;
  let config: TocConfig;

  let customApiConfig = {
    provider: 'auto', // 'auto', 'gemini', 'qwen'
    apiKey: '',
  };

  onMount(() => {
    $pdfService = new PDFService();
  });

  tocConfig.subscribe((value) => (config = value));

  $: {
    if (pdfState.instance && pdfState.currentPage && $pdfService && isPreviewMode) {
      $pdfService.renderPage(pdfState.instance, pdfState.currentPage, pdfState.scale);
    }
  }

  $: if (showOffsetModal) {
    offsetPreviewPageNum = tocEndPage + 1;
  }

  let previousAddPhysicalTocPage = addPhysicalTocPage;
  $: {
    if (pdfState.doc && previousAddPhysicalTocPage !== addPhysicalTocPage && !isFileLoading) {
      previousAddPhysicalTocPage = addPhysicalTocPage;
      if (isPreviewMode) {
        debouncedUpdatePDF();
      }
    }
  }

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

  const debouncedUpdatePDF = debounce(updatePDF, 300);
  tocItems.subscribe((items) => {
    if (items.length > 0) showNextStepHint = false;
    if (isFileLoading) return;
    if (!hasShownTocHint && addPhysicalTocPage && items.length > 0) {
      toastProps = {
        show: true,
        message: `ToC pages will be inserted at page ${config.insertAtPage || 2}. You can change it in Settings.`,
        type: 'info',
      };
      setTimeout(() => {
        hasShownTocHint = true;
      }, 3000);
    }
    if (!isPreviewMode) return;
    debouncedUpdatePDF();
  });

  tocConfig.subscribe(() => {
    if (isFileLoading) return;
    if (!isPreviewMode) return;
    debouncedUpdatePDF();
  });

  const loadPdfLibraries = async () => {
    if (pdfjs && PdfLib) return;
    try {
      const [pdfjsModule, PdfLibModule] = await Promise.all([import('pdfjs-dist'), import('pdf-lib')]);
      pdfjs = pdfjsModule;
      PdfLib = PdfLibModule;
    } catch (error) {
      console.error('Failed to load PDF libraries:', error);
      toastProps = {
        show: true,
        message: 'Failed to load core components. Please refresh and try again.',
        type: 'error',
      };
      throw new Error('Failed to load PDF libraries', {cause: error});
    }
  };

  function updateTocField(fieldPath, value) {
    tocConfig.update((cfg) => {
      const keys = fieldPath.split('.');
      let target = cfg;
      keys.slice(0, -1).forEach((key) => (target = target[key]));
      target[keys[keys.length - 1]] = value;
      return cfg;
    });
  }

  function buildTree(items: {title: string; level: number; page: number}[]): TocItem[] {
    const root: TocItem[] = [];
    const stack: {node: TocItem; level: number}[] = [];
    let idCounter = 0;
    items.forEach((item) => {
      const newItem: TocItem = {
        id: `item-${idCounter++}`,
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

  async function updatePDF() {
    if (!pdfState.doc || !$pdfService) return;
    if (!pdfjs || !PdfLib) {
      console.error('PDF libraries not loaded.');
      toastProps = {show: true, message: 'Components not loaded. Please re-upload your file.', type: 'error'};
      return;
    }

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

      const loadingTask = pdfjs.getDocument(pdfBytes);
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
      updateViewerInstance();
    } catch (error) {
      console.error('Error updating PDF:', error);
      toastProps = {show: true, message: `Error updating PDF: ${error.message}`, type: 'error'};
    }
  }

  const togglePreviewMode = async () => {
    if (!originalPdfInstance) return;
    if (!isPreviewMode) {
      isPreviewLoading = true;
      try {
        if (!previewPdfInstance || previewPdfInstance === originalPdfInstance) {
          await updatePDF();
        }
        if (!previewPdfInstance || previewPdfInstance === originalPdfInstance) {
          toastProps = {
            show: true,
            message: 'Add ToC items or enable "Add physical ToC page" to generate a preview.',
            type: 'error',
          };
        } else {
          isPreviewMode = true;
        }
      } catch (error) {
        console.error('Error generating preview:', error);
        toastProps = {show: true, message: `Error generating preview: ${error.message}`, type: 'error'};
      } finally {
        isPreviewLoading = false;
      }
    } else {
      isPreviewMode = false;
    }
    pdfState.currentPage = 1;
    updateViewerInstance();
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

  const loadPdfFile = async (file: File) => {
    if (!file) return;

    const fingerprint = `${file.name}_${file.size}`;

    curFileFingerprint.set(fingerprint);
    localStorage.setItem('tocify_last_fingerprint', fingerprint);

    isFileLoading = true;
    showNextStepHint = false;
    hasShownTocHint = false;
    pdfState.filename = file.name;
    pdfState.instance = null;
    pdfState.totalPages = 0;
    originalPdfInstance = null;
    previewPdfInstance = null;
    pdfState = {...pdfState};

    try {
      await loadPdfLibraries();

      if (!pdfjs || !PdfLib) {
        return;
      }

      const {PDFDocument} = PdfLib;

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      pdfState.doc = await PDFDocument.load(uint8Array);

      const loadingTask = pdfjs.getDocument(uint8Array);
      originalPdfInstance = await loadingTask.promise;

      previewPdfInstance = originalPdfInstance;
      isPreviewMode = false;
      tocPageCount = 0;
      pdfState.currentPage = 1;
      tocStartPage = 1;
      tocEndPage = 1;

      const session = localStorage.getItem(`toc_draft_${fingerprint}`);

      if (session) {
        const {items, pageOffset} = JSON.parse(session);
        tocItems.set(items);
        updateTocField('pageOffset', pageOffset);

        toastProps = {show: true, message: '已恢复上次的进度 💾', type: 'success'};
      } else {
        tocItems.set([]);
        updateTocField('pageOffset', 0);
      }
    } catch (error) {
      console.error('Error loading PDF:', error);
      toastProps = {show: true, message: `Error loading PDF: ${error.message}`, type: 'error'};
    } finally {
      updateViewerInstance();
      await tick();
      isFileLoading = false;
      showNextStepHint = true;
    }
  };

  const handleFileDrop = async (e: CustomEvent) => {
    const {acceptedFiles} = e.detail;
    isDragging = false;
    if (acceptedFiles.length) {
      await loadPdfFile(acceptedFiles[0]);
    }
  };

  const handleFileLoaded = (event: CustomEvent<{message: string; type: 'success' | 'error' | 'info'}>) => {
    toastProps = {show: true, message: event.detail.message, type: event.detail.type};
  };

  const handleFileInputChange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      await loadPdfFile(target.files[0]);
      target.value = '';
    }
  };

  const triggerFileInput = () => fileInputRef?.click();

  const exportPDF = async () => {
    await updatePDF();
    if (!pdfState.newDoc) {
      toastProps = {show: true, message: 'Error: No PDF document to export.', type: 'error'};
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
      toastProps = {show: true, message: 'Export Successful!', type: 'success'};
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toastProps = {show: true, message: `Error exporting PDF: ${error.message}`, type: 'error'};
    }
  };

  const generateTocFromAI = async () => {
    showNextStepHint = false;
    if (!originalPdfInstance || !$pdfService) {
      toastProps = {show: true, message: 'Please load a PDF first.', type: 'error'};
      return;
    }
    if (tocEndPage < tocStartPage) {
      toastProps = {show: true, message: 'End page must be greater than or equal to start page.', type: 'error'};
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
        body: JSON.stringify({
          images: imagesBase64,
          apiKey: customApiConfig.apiKey,
          provider: customApiConfig.provider,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        let friendlyMessage = err.message || 'AI processing failed.';
        if (
          friendlyMessage.includes('No valid ToC') ||
          friendlyMessage.includes('parsing error') ||
          friendlyMessage.includes('structure')
        ) {
          friendlyMessage = "The selected pages don't look like a ToC. Please try adjusting the page range.";
        }
        throw new Error(friendlyMessage);
      }
      const aiResult: {title: string; level: number; page: number}[] = await response.json();
      if (!aiResult || aiResult.length === 0) {
        aiError = 'We could not find a valid ToC on these pages.';
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
      aiError = error.message;
    } finally {
      isAiLoading = false;
    }
  };

  const handleOffsetConfirm = async () => {
    if (!firstTocItem) return;
    const labeledPage = firstTocItem.to;
    const physicalPage = offsetPreviewPageNum;
    const offset = physicalPage - labeledPage;
    updateTocField('pageOffset', offset);

    const hasChinese = pendingTocItems.some((item) => /[\u4e00-\u9fa5]/.test(item.title));
    const rootTitle = hasChinese ? '目录' : 'Contents';
    const firstTitleNormalized = pendingTocItems[0]?.title?.trim().toLowerCase();
    const isDuplicate =
      firstTitleNormalized === '目录' ||
      firstTitleNormalized === 'contents' ||
      firstTitleNormalized === 'table of contents';

    if (!isDuplicate) {
      const rootNode: TocItem = {
        id: `root-${Date.now()}`,
        title: rootTitle,
        to: tocStartPage - offset,
        children: [],
        open: true,
      };
      pendingTocItems.unshift(rootNode);
    }

    tocItems.set(pendingTocItems);
    showOffsetModal = false;
    pendingTocItems = [];
    firstTocItem = null;

    if (!isPreviewMode) {
      await togglePreviewMode();
    }
  };

  const debouncedJumpToPage = debounce((page: number) => {
    if (page > 0 && page <= pdfState.totalPages) {
      pdfState.currentPage = page;
      pdfState = {...pdfState};
    }
  }, 200);

  const handleTocItemHover = (e: CustomEvent) => {
    if (!isPreviewMode) return;
    const logicalPage = e.detail.to as number;
    const physicalContentPage = logicalPage + config.pageOffset;
    let targetPage: number;
    const insertedPages = addPhysicalTocPage ? tocPageCount : 0;
    if (physicalContentPage >= config.insertAtPage) {
      targetPage = physicalContentPage + insertedPages;
    } else {
      targetPage = physicalContentPage;
    }
    debouncedJumpToPage(targetPage);
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

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if ($tocItems.length > 0) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  };

  const jumpToTocPage = async () => {
    if (!previewPdfInstance) {
      toastProps = {show: true, message: 'Please edit the ToC first to generate a preview.', type: 'error'};
      return;
    }
    if (!isPreviewMode) {
      await togglePreviewMode();
      if (!isPreviewMode) return;
    }
    await tick();
    const targetPage = config.insertAtPage || 2;
    if (targetPage > 0 && targetPage <= pdfState.totalPages) {
      pdfState.currentPage = targetPage;
      pdfState = {...pdfState};
    } else {
      toastProps = {show: true, message: `Invalid ToC start page: ${targetPage}`, type: 'error'};
    }
  };

  function handleApiConfigChange(e: CustomEvent) {
    customApiConfig = e.detail;
  }

  function handleApiConfigSave() {
    toastProps = {show: true, message: 'API Settings Saved!', type: 'success'};
  }
</script>

{#if toastProps.show}
  <Toast
    message={toastProps.message}
    type={toastProps.type}
    on:close={() => (toastProps.show = false)}
  />
{/if}

{#if $isLoading}
  <div class="fixed inset-0 bg-white flex items-center justify-center z-50">
    <div class="animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent"></div>
  </div>
{:else}
  <div
    class="flex flex-col lg:flex-row mt-4 lg:mt-8 p-2 md:p-4 gap-4 lg:gap-8 mx-auto w-[95%] md:w-[90%] xl:w-[80%] 3xl:w-[75%] font-mono justify-between"
  >
    <div
      class="w-full lg:w-[35%]"
      in:fly={{y: 20, duration: 300, delay: 100}}
      out:fade
    >
      <Header on:openhelp={() => (showHelpModal = true)} />

      <ApiSetting
        on:change={handleApiConfigChange}
        on:save={handleApiConfigSave}
      />

      <TocSettings
        bind:isTocConfigExpanded
        bind:addPhysicalTocPage
        {config}
        {previewPdfInstance}
        on:toggleExpand={() => (isTocConfigExpanded = !isTocConfigExpanded)}
        on:updateField={(e) => updateTocField(e.detail.path, e.detail.value)}
        on:jumpToTocPage={jumpToTocPage}
      />

      {#if showNextStepHint && originalPdfInstance}
        <div
          class="border-black border-2 rounded-lg p-3 my-4 bg-yellow-200 shadow-[4px_4px_0px_rgba(0,0,0,1)]"
          transition:fade={{duration: 200}}
        >
          <h3 class="font-bold mb-2">{$t('hint.next_step_title')}:</h3>
          <p class="text-sm text-gray-800">
            1. {$t('hint.step_1_text')} <strong class="text-black">{$t('hint.step_1_bold')}</strong>
          </p>
          <p class="text-sm text-gray-800 mt-1">
            2. {$t('hint.step_2_text')} <strong class="text-black"> {$t('hint.step_2_bold')}</strong>
          </p>
          <p class="text-sm text-gray-800 mt-2">
            {$t('hint.or_text')} <strong class="text-black">{$t('hint.manual_add_bold')}</strong>
            {$t('hint.manual_add_text')}
          </p>
        </div>
      {/if}

      {#if originalPdfInstance}
        <div transition:fade={{duration: 200}}>
          <AiPageSelector
            bind:tocStartPage
            bind:tocEndPage
            totalPages={pdfState.totalPages}
          />
        </div>
      {/if}

      <button
        class="btn w-full my-2 font-bold bg-blue-400 transition-all duration-300 text-black border-2 border-black rounded-lg px-3 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] disabled:bg-gray-300 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
        on:click={generateTocFromAI}
        title={isAiLoading
          ? $t('status.generating')
          : !originalPdfInstance
            ? $t('status.load_pdf_first')
            : $t('tooltip.generate_ai')}
        disabled={isAiLoading || !originalPdfInstance}
      >
        {#if isAiLoading}
          <span>{$t('btn.generating')}</span>
        {:else}
          <span>✨ {$t('btn.generate_toc_ai')}</span>
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

    <div
      class="flex flex-col w-full lg:w-[70%]"
      in:fly={{y: 20, duration: 300, delay: 200}}
      out:fade
    >
      <div
        class="h-fit pb-4 min-h-[85vh] top-5 sticky border-black border-2 rounded-lg bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)]"
      >
        {#if isFileLoading}
          <div
            class="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 rounded-lg"
            transition:fade={{duration: 100}}
          >
            <div class="flex flex-col items-center gap-4">
              <div class="animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent"></div>
              <span class="text-xl font-bold">{$t('status.loading_rendering')}</span>
            </div>
          </div>
        {:else}
          <Dropzone
            containerClasses="absolute inset-0 w-full h-full"
            accept=".pdf"
            disableDefaultStyles
            on:drop={handleFileDrop}
            on:dragenter={() => (isDragging = true)}
            on:dragleave={() => (isDragging = false)}
          >
            <DropzoneView
              {isDragging}
              hasInstance={!!pdfState.instance}
            />
          </Dropzone>
        {/if}
        {#if pdfState.instance}
          <div class="relative z-10 h-full flex flex-col">
            <PDFViewer
              bind:pdfState
              on:fileloaded={handleFileLoaded}
              mode={isPreviewMode ? 'single' : 'grid'}
              {tocStartPage}
              {tocEndPage}
              on:setstartpage={handleSetStartPage}
              on:setendpage={handleSetEndPage}
              {jumpToTocPage}
              {addPhysicalTocPage}
              hasPreview={!!previewPdfInstance}
            />
            <input
              type="file"
              class="hidden"
              accept=".pdf"
              bind:this={fileInputRef}
              on:change={handleFileInputChange}
            />
            <PdfControls
              {isPreviewLoading}
              {isPreviewMode}
              {originalPdfInstance}
              doc={pdfState.doc}
              on:triggerUpload={triggerFileInput}
              on:togglePreview={togglePreviewMode}
              on:export={exportPDF}
            />
          </div>
        {/if}
      </div>
    </div>
    
  </div>
  <Footer />

  <AiLoadingModal
    {isAiLoading}
    {tocStartPage}
    {tocEndPage}
  />
  <OffsetModal
    bind:showOffsetModal
    bind:offsetPreviewPageNum
    {firstTocItem}
    totalPages={pdfState.totalPages}
    on:confirm={handleOffsetConfirm}
  />
  <HelpModal
    bind:showHelpModal
    {videoUrl}
  />

  {/if}

<svelte:window on:beforeunload={handleBeforeUnload} />

<svelte:head>
  <title>{$t('meta.title') || 'Tocify · Add or edit PDF Table of Contents online'}</title>
  <meta
    name="description"
    content={$t('meta.description') ||
      'A free, online tool to automatically generate Table of Contents (bookmarks) for PDFs.'}
  />
  <link
    rel="canonical"
    href="https://tocify.vercel.app/"
  />
  <meta
    name="keywords"
    content="PDF Table of Contents, PDF Bookmarks, Scanned PDF outline, PDF 目录生成, PDF 加书签, 扫描版 PDF 目录, AI PDF 工具"
  />
  <meta
    property="og:title"
    content="Tocify - 给 PDF 自动生成目录"
  />
  <meta
    property="og:description"
    content="一个免费为 PDF 添加目录（书签）的在线工具"
  />
  <meta
    name="twitter:card"
    content="summary_large_image"
  />
  <meta
    name="twitter:image"
    content="/og-image.png"
  />
  <link
    rel="icon"
    href="/favicon.svg"
    type="image/svg"
  />
  <link
    rel="icon"
    href="/favicon.png"
    sizes="any"
  />
</svelte:head>
