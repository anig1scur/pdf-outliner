<script lang="ts">
  import {fade} from 'svelte/transition';
  import {t} from 'svelte-i18n';
  import {createEventDispatcher} from 'svelte';

  import Header from '../Header.svelte';
  import ApiSetting from '../ApiSetting.svelte';
  import TocSettings from '../TocSetting.svelte';
  import AiPageSelector from '../PageSelector.svelte';
  import TocEditor from '../TocEditor.svelte';

  export let pdfState: any;
  export let originalPdfInstance: any;
  export let previewPdfInstance: any;
  export let isAiLoading = false;
  export let aiError: string | null = null;
  export let showNextStepHint = false;

  export let tocStartPage: number;
  export let tocEndPage: number;
  export let addPhysicalTocPage: boolean;
  export let isTocConfigExpanded: boolean;

  export let config: any;
  export let customApiConfig: any;
  export let tocPageCount: number;
  export let isPreviewMode: boolean;

  const dispatch = createEventDispatcher();
</script>

<div class="w-full lg:w-[35%]">
  <Header on:openhelp={() => dispatch('openhelp')} />

  <ApiSetting
    on:change={(e) => dispatch('apiConfigChange', e.detail)}
    on:save={() => dispatch('apiConfigSave')}
  />

  <TocSettings
    {config}
    {previewPdfInstance}
    bind:isTocConfigExpanded
    bind:addPhysicalTocPage
    on:toggleExpand={() => (isTocConfigExpanded = !isTocConfigExpanded)}
    on:updateField={(e) => dispatch('updateField', e.detail)}
    on:jumpToTocPage={() => dispatch('jumpToTocPage')}
  />

  {#if showNextStepHint && originalPdfInstance}
    <div
      class="border-black border-2 rounded-lg p-3 my-4 bg-yellow-200 shadow-[2px_2px_0px_rgba(0,0,0,1)]"
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
    class="btn w-full my-2 font-bold bg-blue-400 transition-all duration-300 text-black border-2 border-black rounded-lg px-3 py-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] disabled:bg-gray-300 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
    on:click={() => dispatch('generateAi')}
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
    on:hoveritem
    currentPage={pdfState.currentPage}
    isPreview={isPreviewMode}
    pageOffset={config.pageOffset}
    insertAtPage={config.insertAtPage}
    apiConfig={customApiConfig}
    tocPageCount={addPhysicalTocPage ? tocPageCount : 0}
  />
</div>
