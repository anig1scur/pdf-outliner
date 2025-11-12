<script lang="ts">
  import {fade} from 'svelte/transition';

  export let isAiLoading: boolean;
  export let tocStartPage: number;
  export let tocEndPage: number;
</script>

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
