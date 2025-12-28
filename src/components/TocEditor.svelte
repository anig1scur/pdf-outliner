<script>
  import {onDestroy, tick} from 'svelte';
  import ShortUniqueId from 'short-unique-id';
  import {CircleHelpIcon} from 'lucide-svelte';
  import { t } from 'svelte-i18n'; 
  import TocItem from './TocItem.svelte';
  import Tooltip from './Tooltip.svelte';
  import {tocItems, maxPage} from '../stores';
  
  import { dndzone } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';

  export let currentPage = 1;
  export let isPreview = false;
  export let pageOffset = 0;
  export let insertAtPage = 2;
  export let tocPageCount = 0;

  const flipDurationMs = 200;

  let text = ``;
  let isUpdatingFromEditor = false;
  let debounceTimer;

  const unsubscribe = tocItems.subscribe((value) => {
    if (isUpdatingFromEditor) return;

    const newText = generateText(value);
    if (newText !== text) {
      text = newText;
    }
  });

  onDestroy(unsubscribe);

  //  (Text -> Items)
  function parseText(text) {
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const items = [];
    const stack = [{level: 0, item: {children: items}}];

    lines.forEach((line) => {
      const match = line.match(/^(\d+(?:\.\d+)*)\s+(.+?)\s+(-?\d+)$/);
      if (match) {
        const [, number, title, pageStr] = match;
        const level = number.split('.').length;
        const page = parseInt(pageStr);
        
        const newItem = {
          id: new ShortUniqueId({length: 10}),
          title,
          to: page,
          children: [],
          open: true,
        };

        if (page > $maxPage) $maxPage = page;

        while (stack[stack.length - 1].level >= level) stack.pop();
        stack[stack.length - 1].item.children.push(newItem);
        stack.push({level, item: newItem});
      }
    });
    return items;
  }

  //  (Items -> Text)
  function generateText(items, prefix = '') {
    return items
      .map((item, index) => {
        const number = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
        let txt = `${number} ${item.title} ${item.to}`;
        if (item.children?.length) txt += '\n' + generateText(item.children, number);
        return txt;
      })
      .join('\n');
  }

  function handleInput(e) {
    isUpdatingFromEditor = true; 
    text = e.target.value;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      $tocItems = parseText(text);
      tick().then(() => {
         isUpdatingFromEditor = false; 
      });
    }, 300);
  }

  function handleDndConsider(e) {
    $tocItems = e.detail.items;
  }

  function handleDndFinalize(e) {
    $tocItems = e.detail.items;
  }

  $: firstItemWithChildrenId = (() => {
    const findFirst = (items) => {
      for (const item of items) {
        if (item.children?.length > 0) return item.id;
        if (item.children) {
          const childResult = findFirst(item.children);
          if (childResult) return childResult;
        }
      }
      return null;
    };
    return findFirst($tocItems);
  })();

  const addTocItem = () => {
    $tocItems = [...$tocItems, {
        id: new ShortUniqueId({length: 10}),
        title: $t('toc.new_section_default'),
        to: $maxPage + 1,
        children: [],
        open: true,
      }];
  };

  const updateTocItem = (item, updates) => {
    const updateItemRecursive = (items) => items.map((currentItem) => {
        if (currentItem.id === item.id) return {...currentItem, ...updates};
        if (currentItem.children?.length) {
          return {...currentItem, children: updateItemRecursive(currentItem.children)};
        }
        return currentItem;
      });
    $tocItems = updateItemRecursive($tocItems);
  };

  const deleteTocItem = (itemToDelete) => {
     const deleteItemRecursive = (items) =>
      items.filter((item) => {
        if (item.id === itemToDelete.id) return false;
        if (item.children?.length) item.children = deleteItemRecursive(item.children);
        return true;
      });
    $tocItems = deleteItemRecursive($tocItems);
  };

  $: promptTooltipText = `${$t('toc.prompt_intro')}:\n\n1 Food Categories I Love 1\n2 Fruits 2\n2.1 Strawberry 3

${$t('toc.prompt_instruction')}

\${YOUR_TOCS_COPY_FROM_ANYWHERE}`;

</script>

<div class="flex flex-col gap-4 mt-3">
  <div class="h-32 relative">
    <div class="absolute -left-2">
      <Tooltip isTextCopiable width="min-w-96" text={promptTooltipText} position="right" className="-ml-6">
        <CircleHelpIcon size={16} />
      </Tooltip>
    </div>

    <textarea
      bind:value={text}
      on:input={handleInput}
      class="w-full h-full border-2 border-black rounded-lg p-2 text-sm myfocus leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
    ></textarea>
  </div>

  <div class="-ml-9">
    {#if $tocItems.length > 0}
      <section
        use:dndzone={{items: $tocItems, flipDurationMs, dropTargetStyle: {outline: '2px dashed #000', borderRadius: '8px'}}}
        on:consider={handleDndConsider}
        on:finalize={handleDndFinalize}
        class="min-h-[20px]"
      >
        {#each $tocItems as item (item.id)}
          <div animate:flip={{duration: flipDurationMs}}>
            <TocItem
              {item}
              showTooltip={item.id === firstItemWithChildrenId}
              onUpdate={updateTocItem}
              onDelete={deleteTocItem}
              on:hoveritem
              {currentPage}
              {isPreview}
              {pageOffset}
              {insertAtPage}
              {tocPageCount}
            />
          </div>
        {/each}
      </section>
    {/if}
    
    <button
      on:click={addTocItem}
      class="ml-9 mt-3 mb-4 btn font-bold bg-yellow-400 text-black border-2 border-black rounded-lg px-4 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
    >
      {$t('btn.add_section')}
    </button>
  </div>
</div>