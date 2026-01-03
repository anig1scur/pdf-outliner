<script lang="ts">
  import {onMount, tick} from 'svelte';
  import {slide, fade, fly} from 'svelte/transition';
  import {t, isLoading} from 'svelte-i18n';
  import {injectAnalytics} from '@vercel/analytics/sveltekit';
  import type * as PdfjsLibTypes from 'pdfjs-dist';
  import {init, trackEvent} from '@aptabase/web';

  import '../lib/i18n';
  import {pdfService, tocItems, curFileFingerprint, tocConfig, type TocConfig} from '../stores';
  import {PDFService, type PDFState, type TocItem} from '../lib/pdf-service';
  import {setOutline} from '../lib/pdf-outliner';
  import {debounce} from '../lib';
  import {buildTree, convertPdfJsOutlineToTocItems, setNestedValue} from '$lib/utils';
  import {generateToc} from '$lib/toc-service';

  import Toast from '../components/Toast.svelte';
  import Footer from '../components/Footer.svelte';

  import AiLoadingModal from '../components/modals/AiLoadingModal.svelte';
  import OffsetModal from '../components/modals/OffsetModal.svelte';
  import HelpModal from '../components/modals/HelpModal.svelte';

  import DownloadBanner from '../components/DownloadBanner.svelte';
  import SidebarPanel from '../components/panels/SidebarPanel.svelte';
  import PreviewPanel from '../components/panels/PreviewPanel.svelte';

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
    provider: '',
    apiKey: '',
  };

  onMount(() => {
    $pdfService = new PDFService();
  });

  onMount(() => {
    init('A-US-0422911470');

    trackEvent('app_started', {
      platform: window.__TAURI__ ? 'desktop' : 'web',
      version: '1.0.0',
    });
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

  function updateTocField(fieldPath: string, value: any) {
    tocConfig.update((cfg) => {
      return setNestedValue(cfg, fieldPath, value);
    });
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
      toastProps = {show: true, message: 'Components not loaded. Please reupload your file.', type: 'error'};
      return;
    }

    try {
      const currentPageBackup = pdfState.currentPage;
      let newDoc = pdfState.doc;
      let tocPageCount = 0;

      if (addPhysicalTocPage) {
        const res = await $pdfService.createTocPage(pdfState.doc, $tocItems, config.insertAtPage);
        newDoc = res.newDoc;
        tocPageCount = res.tocPageCount;
      }

      setOutline(newDoc, $tocItems, config.pageOffset, tocPageCount);
      const pdfBytes = await newDoc.save({
        useObjectStreams: false,
      });

      const loadingTask = pdfjs.getDocument({
        data: pdfBytes,
        worker: PDFService.sharedWorker,
      });

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
      const msg =
        error.name === 'InvalidPDFException'
          ? 'The PDF structure is too old or corrupted to generate a preview.'
          : error.message;
      toastProps = {show: true, message: `Error updating PDF: ${msg}`, type: 'error'};
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
    console.log(file);
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

      const loadingTask = pdfjs.getDocument({
        data: uint8Array,
        worker: PDFService.sharedWorker,
      });
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
      } else {
        try {
          const existingOutline = await originalPdfInstance.getOutline();

          if (existingOutline && existingOutline.length > 0) {
            const importedItems = await convertPdfJsOutlineToTocItems(existingOutline, originalPdfInstance);
            tocItems.set(importedItems);
            updateTocField('pageOffset', 0);

            toastProps = {show: true, message: 'The raw ToC has been imported from the PDF.', type: 'info'};
          } else {
            tocItems.set([]);
            updateTocField('pageOffset', 0);
          }
        } catch (err) {
          console.warn('PDF load outline error:', err);
          tocItems.set([]);
          updateTocField('pageOffset', 0);
        }
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

    if (!originalPdfInstance) {
      toastProps = {show: true, message: 'Please load a PDF first.', type: 'error'};
      return;
    }

    isAiLoading = true;
    aiError = null;

    try {
      const res = await generateToc({
        pdfInstance: originalPdfInstance,
        startPage: tocStartPage,
        endPage: tocEndPage,
        apiKey: customApiConfig.apiKey,
        provider: customApiConfig.provider,
      });

      if (!res || res.length === 0) {
        aiError = 'We could not find a valid ToC on these pages.';
        return;
      }

      const nestedTocItems = buildTree(res);

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
      toastProps = {show: true, message: error.message, type: 'error'};
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

  const handleViewerMessage = (event: CustomEvent<{message: string; type: 'success' | 'error' | 'info'}>) => {
    toastProps = {show: true, message: event.detail.message, type: event.detail.type};
  };

  onMount(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || event.reason || 'Unknown Async Error';
      toastProps = {show: true, message: msg, type: 'error'};
      event.preventDefault();
    };

    const handleSyncError = (event: ErrorEvent) => {
      const msg = event.message || 'Unknown Error';
      toastProps = {show: true, message: msg, type: 'error'};
    };

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleSyncError);

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleSyncError);
    };
  });
</script>

<DownloadBanner />

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
    class="flex flex-col mt-5 lg:flex-row lg:mt-10 p-2 md:p-4 gap-4 lg:gap-8 mx-auto w-[95%] md:w-[90%] xl:w-[80%] 3xl:w-[75%] justify-between"
  >
    <div
      in:fly={{y: 20, duration: 300, delay: 100}}
      out:fade
      class="contents"
    >
      <SidebarPanel
        {pdfState}
        {originalPdfInstance}
        {previewPdfInstance}
        {isAiLoading}
        {aiError}
        {showNextStepHint}
        {config}
        {customApiConfig}
        {tocPageCount}
        {isPreviewMode}
        bind:tocStartPage
        bind:tocEndPage
        bind:addPhysicalTocPage
        bind:isTocConfigExpanded
        on:openhelp={() => (showHelpModal = true)}
        on:apiConfigChange={handleApiConfigChange}
        on:apiConfigSave={handleApiConfigSave}
        on:updateField={(e) => updateTocField(e.detail.path, e.detail.value)}
        on:jumpToTocPage={jumpToTocPage}
        on:generateAi={generateTocFromAI}
        on:hoveritem={handleTocItemHover}
        on:fileselect={(e) => loadPdfFile(e.detail)}
        on:viewerMessage={handleViewerMessage}
        on:setstartpage={handleSetStartPage}
        on:setendpage={handleSetEndPage}
        on:togglePreview={togglePreviewMode}
        on:export={exportPDF}
      />
    </div>

    <div
      in:fly={{y: 20, duration: 300, delay: 200}}
      out:fade
      class="contents"
    >
      <PreviewPanel
        {isFileLoading}
        {pdfState}
        {originalPdfInstance}
        {previewPdfInstance}
        {isPreviewMode}
        {isPreviewLoading}
        {tocStartPage}
        {tocEndPage}
        {addPhysicalTocPage}
        {jumpToTocPage}
        bind:isDragging
        on:fileselect={(e) => loadPdfFile(e.detail)}
        on:viewerMessage={handleViewerMessage}
        on:setstartpage={handleSetStartPage}
        on:setendpage={handleSetEndPage}
        on:togglePreview={togglePreviewMode}
        on:export={exportPDF}
      />
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
    href="https://tocify.aeriszhu.com/"
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
    href="/favicon.ico"
  />
  <link
    rel="icon"
    type="image/svg+xml"
    href="/favicon.svg"
  />
  <link
    rel="icon"
    type="image/png"
    href="/favicon.png"
  />
</svelte:head>
