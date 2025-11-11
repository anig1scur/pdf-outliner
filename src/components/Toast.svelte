<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { X, CheckCircle, AlertTriangle } from 'lucide-svelte';

  export let message = 'Success!';
  export let duration = 3000;
  export let type: 'success' | 'error' = 'success';

  const dispatch = createEventDispatcher();

  onMount(() => {
    const timer = setTimeout(() => {
      dispatch('close');
    }, duration);
    return () => clearTimeout(timer);
  });
</script>

<div
  class="fixed bottom-5 right-5 text-black p-4 rounded-lg shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center z-50 border-2 border-black"
  class:bg-lime-400={type === 'success'}
  class:bg-red-500={type === 'error'}
>
  {#if type === 'success'}
    <CheckCircle size={20} class="mr-3 flex-shrink-0" />
  {:else}
    <AlertTriangle size={20} class="mr-3 flex-shrink-0" />
  {/if}

  <span class="font-semibold">{message}</span>

  <button
    on:click={() => dispatch('close')}
    class="ml-4 p-1 rounded-full text-black hover:bg-black hover:text-white transition-colors"
  >
    <X size={20} />
  </button>
</div>