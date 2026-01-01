<script lang="ts">
  import {fade, fly} from 'svelte/transition';
  import {X, Copy, Check} from 'lucide-svelte';

  export let showHelpModal: boolean;
  export let videoUrl: string;

  const email = 'anigiscur@gmail.com';
  let copied = false;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };
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
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-2xl font-bold">How to Use Tocify</h2>

          <button
            on:click={copyEmail}
            class="group flex items-center gap-1.5 px-2 py-1 text-xs font-bold border-2 border-black rounded shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all active:bg-black active:text-white
                {copied ? 'bg-green-400' : 'bg-white hover:bg-yellow-200'}"
            title="Click to copy email"
          >
            📮
            {#if copied}
              <span>Copied!</span>
            {:else}
              <span>{email}</span>
            {/if}
          </button>
        </div>

        <button
          on:click={() => (showHelpModal = false)}
          class="absolute top-4 right-4 md:relative md:top-auto md:right-auto p-1 rounded-full text-black hover:bg-black hover:text-white transition-colors"
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
