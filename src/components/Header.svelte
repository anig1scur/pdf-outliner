<script lang="ts">
  import {createEventDispatcher} from 'svelte';
  import {Github, HelpCircle} from 'lucide-svelte';
  import Logo from '../assets/logo-dark.svelte';

  const dispatch = createEventDispatcher();
</script>

<div class="flex justify-between items-start gap-4">
  <div>
    <div class="flex items-center gap-2">
      <Logo />
      <h1 class="text-3xl tracking-widest font-semibold">Tocify</h1>
    </div>
    <p class="text-xs text-gray-600 mt-1 pl-1">
      PDF Table of Contents Editor
    </p>
  </div>

  <div class="flex items-center gap-2 pt-2">
    <a
      href="https://github.com/anig1scur/tocify"
      target="_blank"
      rel="noopener noreferrer"
      class="text-black hover:text-gray-700 transition-colors"
      title="View on GitHub"
    >
      <Github size={32} />
    </a>
    <button
      on:click={() => dispatch('openhelp')}
      class="text-black hover:text-gray-700 transition-colors"
      title="How to Use"
    >
      <HelpCircle size={32} />
    </button>
  </div>
</div>