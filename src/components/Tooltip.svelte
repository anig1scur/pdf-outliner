<script>
  export let className = '';
  export let text = 'Tooltip text';
  export let position = 'top';
  export let width = 'min-w-72'; // Default width class
  export let isTextCopiable = false; // Default is not copyable
  let isVisible = false;
  let timer = null;

  const delay = (func) => {
    return () => {
      timer = setTimeout(func, 300);
    };
  };

  const setVisible = () => {
    if (timer) {
      clearTimeout(timer);
    }
    isVisible = true;
  };

  const setInVisible = () => {
    isVisible = false;
  };

  const copyText = () => {
    navigator.clipboard.writeText(text);
  };
</script>

<div class={'relative inline-block ' + className}>
  <button
    class="cursor-pointer"
    on:mouseenter={setVisible}
    on:mouseleave={delay(setInVisible)}
  >
    <slot />
  </button>

  {#if isVisible}
    <button
      on:mouseenter={setVisible}
      on:mouseleave={delay(setInVisible)}
      on:click={isTextCopiable ? copyText : null}
      class={`whitespace-pre-wrap ${width} ${isTextCopiable ? 'cursor-copy' : ''} bg-opacity-60 backdrop-blur-sm absolute z-10 px-3 py-2 text-sm text-white bg-black rounded shadow-lg
      ${position === 'top' ? 'bottom-full left-1/2 transform -translate-x-1/2 mb-2' : ''}
      ${position === 'bottom' ? 'top-full left-1/2 transform -translate-x-1/2 mt-2' : ''}
      ${position === 'left' ? 'right-full top-1/2 transform -translate-y-1/2 mr-2' : ''}
      ${position === 'right' ? 'left-full top-1/2 transform -translate-y-1/2 ml-2' : ''}`}
    >
      {text}
      <span
        class={`absolute w-2 h-2 bg-black bg-opacity-50 transform rotate-45
        ${position === 'top' ? 'bottom-[-4px] left-1/2 transform -translate-x-1/2' : ''}
        ${position === 'bottom' ? 'top-[-4px] left-1/2 transform -translate-x-1/2' : ''}
        ${position === 'left' ? 'right-[-4px] top-1/2 transform -translate-y-1/2' : ''}
        ${position === 'right' ? 'left-[-4px] top-1/2 transform -translate-y-1/2' : ''}`}
      ></span>
    </button>
  {/if}
</div>
