<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { X, CheckCircle } from 'lucide-svelte';

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
  class="fixed bottom-5 right-5 text-white p-4 rounded-lg shadow-lg flex items-center z-50"
  class:bg-green-600={type === 'success'}
  class:bg-red-600={type === 'error'}
>
  <CheckCircle size={20} class="mr-3" />
  <span>{message}</span>
  <button
    on:click={() => dispatch('close')}
    class="ml-4 text-white hover:text-gray-200"
  >
    <X size={20} />
  </button>
</div>