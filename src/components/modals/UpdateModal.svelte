<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { Sparkles, Download, X, Rocket } from 'lucide-svelte';

  export let showUpdateModal: boolean = false;
  export let updateData: { version: string; body: string; date?: string } | null = null;
  
  export let onUpdate: () => void;
  export let onCancel: () => void;
</script>

{#if showUpdateModal && updateData}
  <div
    class="fixed inset-0 bg-gray-400/90 flex items-center justify-center z-[60] p-4"
    transition:fade={{ duration: 150 }}
    on:click={onCancel}
  >
    <div
      class="bg-white rounded-lg p-0 max-w-lg w-full max-h-[85vh] flex flex-col border-4 border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] relative overflow-hidden"
      transition:fly={{ y: 20, duration: 200 }}
      on:click|stopPropagation
    >
      <div class="bg-yellow-300 border-b-4 border-black p-5 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="bg-white p-2 border-2 border-black rounded shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <Sparkles size={24} class="text-black" />
          </div>
          <div>
            <h2 class="text-2xl font-black italic tracking-tighter">NEW VERSION</h2>
            <p class="text-xs font-bold font-mono">v{updateData.version} is available!</p>
          </div>
        </div>
        
        <button
          on:click={onCancel}
          class="p-2 rounded-lg border-2 border-transparent hover:bg-black hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <div class="p-6 overflow-y-auto custom-scrollbar">
        <div class="prose prose-sm max-w-none">
          <p class="font-bold text-lg mb-2">✨ What's New:</p>
          <div class="bg-gray-50 border-2 border-black rounded p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed">
            {updateData.body || "Bug fixes and performance improvements."}
          </div>
        </div>
      </div>

      <div class="p-6 pt-0 mt-auto grid grid-cols-2 gap-4">
        <button
          on:click={onCancel}
          class="px-4 py-3 font-bold border-2 border-black rounded bg-white text-black hover:bg-gray-100 transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none"
        >
          Later
        </button>

        <button
          on:click={onUpdate}
          class="flex items-center justify-center gap-2 px-4 py-3 font-bold border-2 border-black rounded bg-green-400 text-black transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:bg-green-300 active:shadow-none"
        >
          <Download size={20} strokeWidth={3} />
          Update Now
        </button>
      </div>
    </div>
  </div>
{/if}
