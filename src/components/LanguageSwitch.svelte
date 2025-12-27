<script lang="ts">
  import {locale} from 'svelte-i18n';

  const toggle = () => {
    $locale = $locale && $locale.startsWith('zh') ? 'en' : 'zh';
  };
</script>

<button
  on:click={toggle}
  class="
    font-bold
    text-black
    border-2
    border-black
    rounded-full
    px-2
    py-1
    text-sm
    transition-all
    duration-200
    hover:shadow-none
    hover:translate-x-[1px]
    hover:translate-y-[1px]
    active:translate-x-[1px]
    active:translate-y-[1px]
  "
>
  {#if $locale && $locale.startsWith('zh')}
    EN
  {:else}
    中
  {/if}
</button>
