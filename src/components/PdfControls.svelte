<script lang="ts">
  import {createEventDispatcher} from 'svelte';
  import {Upload, PencilIcon, EyeIcon} from 'lucide-svelte';
  import {fly, fade} from 'svelte/transition'; // 1. 导入过渡效果

  export let isPreviewLoading: boolean;
  export let isPreviewMode: boolean;
  export let originalPdfInstance: any;
  export let doc: any;

  const dispatch = createEventDispatcher();
</script>

<div class="flex flex-col md:flex-row md:justify-end gap-3 md:gap-2 pt-4 relative z-10 mx-3 md:mr-3 md:mx-0">
  <button
    class="btn flex gap-2 items-center justify-center font-bold bg-white text-black border-2 border-black rounded-lg px-4 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all disabled:bg-gray-300 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 w-full md:w-auto"
    on:click={() => dispatch('triggerUpload')}
    title="Upload a new PDF file"
    in:fly={{y: 10, duration: 250, delay: 0}}
  >
    <Upload size={16} />
    Upload New
  </button>
  <button
    class="btn flex gap-2 items-center justify-center font-bold bg-yellow-400 text-black border-2 border-black rounded-lg px-4 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all disabled:bg-gray-300 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 w-full md:w-auto"
    on:click={() => dispatch('togglePreview')}
    disabled={!originalPdfInstance || isPreviewLoading}
    title={isPreviewMode
      ? 'Switch to Edit Mode (Show Original PDF)'
      : 'Switch to Preview Mode (Show Generated PDF)'}
    in:fly={{y: 10, duration: 250, delay: 100}}
  >
    {#key isPreviewLoading.toString() + isPreviewMode.toString()}
      <div
        class="flex gap-2 items-center justify-center"
        in:fade={{duration: 150}}
      >
        {#if isPreviewLoading}
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
          Loading...
        {:else if isPreviewMode}
          <PencilIcon size={16} />
          Select (Grid)
        {:else}
          <EyeIcon size={16} />
          Preview
        {/if}
      </div>
    {/key}
  </button>
  <button
    class="btn font-bold bg-green-500 text-black border-2 border-black rounded-lg px-4 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all disabled:bg-gray-300 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 w-full md:w-auto"
    on:click={() => dispatch('export')}
    disabled={!doc}
    in:fly={{y: 10, duration: 250, delay: 200}}
  >
    Generate Outlined PDF
  </button>
</div>