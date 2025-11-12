<script lang="ts">
  import {createEventDispatcher} from 'svelte';
  import {fade, fly} from 'svelte/transition';
  import {X} from 'lucide-svelte';
  import type {TocItem} from '../../lib/pdf-service';

  export let showOffsetModal: boolean;
  export let firstTocItem: TocItem | null;
  export let offsetPreviewPageNum: number;
  export let totalPages: number;

  const dispatch = createEventDispatcher(); 

  function updatePage(newPage: number) {
    if (newPage > 0 && newPage <= totalPages) {
      offsetPreviewPageNum = newPage;
      dispatch('update:offsetPreviewPageNum', offsetPreviewPageNum);
    }
  }
</script>

{#if showOffsetModal && firstTocItem}
  <div
    class="fixed inset-0 bg-lime-400 flex items-center justify-center z-50 p-4"
    transition:fade={{duration: 150}}
    on:click={() => (showOffsetModal = false)}
  >
    <div
      class="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)]"
      transition:fly={{y: 20, duration: 200}}
      on:click|stopPropagation
    >
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold">Confirm Page Offset By The First ToC Item</h2>
        <button
          on:click={() => (showOffsetModal = false)}
          class="p-1 rounded-full text-black hover:bg-black hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X size={24} />
        </button>
      </div>
      <div class="flex flex-col md:flex-row gap-6">
        <div class="w-full md:w-1/3 flex flex-col text-xl">
          <p class="my-4 text-gray-700">
            We found
            <strong class="text-black text-3xl block my-2">{firstTocItem?.title}</strong>
            on
            <strong class="text-black text-3xl block my-2">Page {firstTocItem?.to} </strong>
          </p>
          <p class="my-4 text-gray-700">Select the physical page where this section actually begins</p>
          <div class="flex gap-4 items-center my-4">
            <label
              for="physical_page_select"
              class="font-semibold">Physical Page:</label
            >
            <div class="flex items-center gap-2">
              <button
                class="btn p-2 h-10 w-10 font-bold bg-white text-black border-2 border-black rounded-lg shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:bg-gray-200 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
                on:click={() => updatePage(offsetPreviewPageNum - 1)}
                disabled={offsetPreviewPageNum <= 1}
              >
                -
              </button>
              <input
                type="number"
                id="physical_page_select"
                bind:value={offsetPreviewPageNum}
                on:input={(e) => updatePage(parseInt(e.currentTarget.value, 10))}
                min={1}
                max={totalPages}
                class="border-2 border-black rounded px-2 py-1 w-20 h-10 text-center font-bold text-2xl [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                class="btn p-2 h-10 w-10 font-bold bg-white text-black border-2 border-black rounded-lg shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:bg-gray-200 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
                on:click={() => updatePage(offsetPreviewPageNum + 1)}
                disabled={offsetPreviewPageNum >= totalPages}
              >
                +
              </button>
            </div>
          </div>
          <button
            on:click={() => dispatch('confirm')}
            class="btn mt-auto font-bold bg-blue-400 text-black border-2 border-black rounded-lg px-4 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all w-full"
          >
            Yes! This page !
          </button>
        </div>
        <div class="w-full md:w-2/3">
          <div class="border-2 border-black rounded-lg overflow-hidden bg-gray-50 h-[75vh]">
            <canvas
              id="offset-preview-canvas"
              class="w-full h-full"
            ></canvas>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}