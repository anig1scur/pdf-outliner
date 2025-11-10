<script lang="ts">
  import {onMount} from 'svelte';
  import * as pdfjsLib from 'pdfjs-dist';
  import Dropzone from 'svelte-file-dropzone';
  import {PDFDocument} from 'pdf-lib';
  import {Eye, EyeOff} from 'lucide-svelte';

  import TocEditor from '../components/TocEditor.svelte';
  import PDFViewer from '../components/PDFViewer.svelte';
  import Logo from '../assets/logo-dark.svelte';

  import {setOutline} from '../lib/pdf-outliner';
  import {PDFService, type PDFState, type TocItem} from '../lib/pdf-service';
  import {tocItems, pdfService, type TocConfig} from '../stores';
  import {debounce} from '../lib';

  import {tocConfig} from '../stores';

  let isTocConfigExpanded = false;

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
  let isAiLoading = false; // [新增] AI 加载状态

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
    if (pdfState.instance) {
      $pdfService.renderPage(pdfState.instance, pdfState.currentPage, pdfState.scale);
    }
  }

  const updatePDF = async () => {
    if (!pdfState.doc) return;

    try {
      const newDoc = await $pdfService.createTocPage(pdfState.doc, $tocItems);

      setOutline(newDoc, $tocItems);
      const pdfBytes = await newDoc.save();
      const loadingTask = pdfjsLib.getDocument(pdfBytes);
      pdfState.instance = await loadingTask.promise;
      pdfState.totalPages = pdfState.instance.numPages;

      await $pdfService.renderPage(pdfState.instance, pdfState.currentPage, pdfState.scale);

      pdfState.newDoc = newDoc;
    } catch (error) {
      console.error('Error updating PDF:', error);
    }
  };

  const debouncedUpdatePDF = debounce(updatePDF, 300);
  tocItems.subscribe(debouncedUpdatePDF);
  tocConfig.subscribe(debouncedUpdatePDF);

  const handleFileDrop = async (e: CustomEvent) => {
    const {acceptedFiles} = e.detail;
    isDragging = false;

    if (acceptedFiles.length) {
      const file = acceptedFiles[0];
      pdfState.filename = file.name;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        pdfState.doc = await PDFDocument.load(uint8Array);

        const loadingTask = pdfjsLib.getDocument(uint8Array);
        pdfState.instance = await loadingTask.promise;
        pdfState.totalPages = pdfState.instance.numPages;
        pdfState.currentPage = 1; // 重置到第一页

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
  
  /**
   * [新增] AI 生成 ToC 的辅助函数
   * 将 AI 返回的扁平列表转换为嵌套树结构
   */
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

  /**
   * [新增] 触发 AI 分析当前页面
   */
  const generateTocFromAI = async () => {
    if (!pdfState.instance || !$pdfService) {
      alert('Please load a PDF first.');
      return;
    }

    isAiLoading = true;
    try {
      // 1. 从 service 获取当前页的 Base64 图像
      const imageBase64 = await $pdfService.getPageAsImage(
        pdfState.instance,
        pdfState.currentPage,
        1.5 // 提高分辨率以保证 OCR 质量
      );

      // 2. 发送到 Vercel Serverless API
      const response = await fetch('/api/process-toc', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({image: imageBase64}),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'AI processing failed.');
      }

      // 3. 获取 AI 解析的 JSON
      const aiResult: { title: string; level: number; page: number }[] = await response.json();

      if (!aiResult || aiResult.length === 0) {
        alert('AI could not find a Table of Contents on this page.');
        return;
      }

      // 4. 将扁平数据转换为嵌套树结构
      const nestedTocItems = buildTree(aiResult);

      // 5. 更新 store，debouncedUpdatePDF 会自动触发
      tocItems.set(nestedTocItems);

    } catch (error) {
      console.error('Error generating ToC from AI:', error);
      alert(`Error: ${error.message}`);
    } finally {
      isAiLoading = false;
    }
  };

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
              bind:checked={config.showNumberedList}
              type="checkbox"
              id="show_numbered_list"
              on:change={(e) => updateTocField('showNumberedList', e.target.checked)}
            />
            <label for="show_numbered_list">with numbered list</label>
          </div>

          <div class="border-dashed border-gray-100 rounded border-2 my-2 p-2 w-72 flex gap-6">
            <label
              class="whitespace-nowrap"
              for="page_offset">Page offset</label
            >
            <input
              type="number"
              id="page_offset"
              bind:value={config.pageOffset}
              on:input={(e) => updateTocField('pageOffset', parseInt(e.target.value, 10) || 0)}
              class="w-[80%]"
            />
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

    <button
      class="btn w-full my-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
      on:click={generateTocFromAI}
      disabled={isAiLoading || !pdfState.instance}
    >
      {#if isAiLoading}
        <span>Analyzing Page {pdfState.currentPage}...</span>
      {:else}
        <span>✨ Generate ToC from Current Page (AI)</span>
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
          disabled={!pdfState.newDoc}
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