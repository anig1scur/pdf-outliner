<script lang="ts">
  import {fade, fly} from 'svelte/transition';
  import {X} from 'lucide-svelte';

  export let showHelpModal: boolean;
  export let videoUrl: string;

</script>

{#if showHelpModal}
  <div
    class="fixed inset-0 bg-lime-400 flex items-center justify-center z-50 p-4"
    transition:fade={{duration: 150}}
    on:click={() => (showHelpModal = false)}
  >
    <div
      class="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)]"
      transition:fly={{y: 20, duration: 200}}
      on:click|stopPropagation
    >
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold">How to Use Tocify</h2>
        <button
          on:click={() => (showHelpModal = false)}
          class="p-1 rounded-full text-black hover:bg-black hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X size={24} />
        </button>
      </div>
      <div class="flex flex-col gap-6">
        <video
          src={videoUrl}
          controls
          loop
          autoplay
          muted
          class="w-full h-auto rounded-lg border-2 border-black"
        ></video>
      </div>
    </div>
  </div>
{/if}