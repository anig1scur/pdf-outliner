<script>
  export let className = '';
  export let text = 'Tooltip text';
  export let position = 'top';
  let isVisible = false;
</script>

<div class={'relative inline-block ' + className}>
  <div
    class="cursor-pointer"
    on:mouseenter={() => (isVisible = true)}
    on:mouseleave={() => (isVisible = false)}
  >
    <slot />
  </div>

  {#if isVisible}
    <div
      class={`whitespace-pre-wrap w-60 bg-opacity-75 absolute z-10 px-2 py-1 text-sm text-white bg-black rounded shadow-lg whitespace-nowrap 
      ${position === 'top' ? 'bottom-full left-1/2 transform -translate-x-1/2 mb-2' : ''}
      ${position === 'bottom' ? 'top-full left-1/2 transform -translate-x-1/2 mt-2' : ''}
      ${position === 'left' ? 'right-full top-1/2 transform -translate-y-1/2 mr-2' : ''}
      ${position === 'right' ? 'left-full top-1/2 transform -translate-y-1/2 ml-2' : ''}`}
    >
      {text}
      <span
        class={`absolute w-2 h-2 bg-black bg-opacity-75 transform rotate-45 
        ${position === 'top' ? 'bottom-[-4px] left-1/2 transform -translate-x-1/2' : ''}
        ${position === 'bottom' ? 'top-[-4px] left-1/2 transform -translate-x-1/2' : ''}
        ${position === 'left' ? 'right-[-4px] top-1/2 transform -translate-y-1/2' : ''}
        ${position === 'right' ? 'left-[-4px] top-1/2 transform -translate-y-1/2' : ''}`}
      ></span>
    </div>
  {/if}
</div>

