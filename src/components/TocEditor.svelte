<script>
  import ShortUniqueId from 'short-unique-id';
  import {CircleHelpIcon} from 'lucide-svelte';
  import TocItem from './TocItem.svelte';
  import Tooltip from './Tooltip.svelte';
  import {tocItems, maxPage} from '../stores';

  
  export let currentPage = 1;
  export let isPreview = false;
  export let pageOffset = 0;
  export let insertAtPage = 2;
  export let tocPageCount = 0;

  let text = ``;
  let isSyncing = false;

  // 订阅 tocItems store
  const unsubscribe = tocItems.subscribe((value) => {
    if (!isSyncing) {
      isSyncing = true;
      text = generateText(value);
      isSyncing = false;
    }
  });

  // 在组件销毁时取消订阅
  import {onDestroy} from 'svelte';
  onDestroy(unsubscribe);

  function parseText(text) {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const items = [];
    const stack = [{level: 0, item: {children: items}}];

    lines.forEach((line) => {
      const match = line.match(/^(\d+(?:\.\d+)*)\s+(.+?)\s+(\d+)$/);
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

  function generateText(items, prefix = '') {
    return items
      .map((item, index) => {
        const number = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
        let text = `${number} ${item.title} ${item.to}`;
        if (item.children?.length) text += '\n' + generateText(item.children, number);
        return text;
      })
      .join('\n');
  }

  // 当用户修改 text 时 → 更新 tocItems
  $: if (!isSyncing) {
    isSyncing = true;
    tocItems.set(parseText(text));
    isSyncing = false;
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
    $tocItems = [
      ...$tocItems,
      {
        id: new ShortUniqueId({length: 10}),
        title: 'New Section',
        to: $maxPage + 1,
        children: [],
        open: true,
      },
    ];
  };

  const updateTocItem = (item, updates) => {
    const updateItemRecursive = (items) =>
      items.map((currentItem) => {
        if (currentItem === item) return {...currentItem, ...updates};
        if (currentItem.children?.length)
          return {
            ...currentItem,
            children: updateItemRecursive(currentItem.children),
          };
        return currentItem;
      });
    $tocItems = updateItemRecursive($tocItems);
  };

  const deleteTocItem = (itemToDelete) => {
    const deleteItemRecursive = (items) =>
      items.filter((item) => {
        if (item === itemToDelete) return false;
        if (item.children?.length) item.children = deleteItemRecursive(item.children);
        return true;
      });
    $tocItems = deleteItemRecursive($tocItems);
  };
</script>

<div class="flex flex-col gap-4 mt-3">
  <div class="h-32 relative">
    <div class="absolute -left-2">
      <Tooltip
        isTextCopiable
        width="min-w-96"
        text={`Prompt to get the target format:

1 Food Categories I Love 1
2 Fruits 2
2.1 Strawberry 3

organize the ToCs in below to the target format, remove useless comments

\${YOUR_TOCS_COPY_FROM_ANYWHERE}`}
        position="right"
        className="-ml-6"
      >
        <CircleHelpIcon size={16} />
      </Tooltip>
    </div>

    <textarea
      bind:value={text}
      placeholder={`
      1 Section Title 1
      2 Subsection Title 2
      3.1 Sub-subsection Title 3
`}
      class="w-full h-full border-2 border-black rounded-lg p-2 text-sm myfocus leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
    ></textarea>
  </div>
  <div class="-ml-9">
    {#if $tocItems.length > 0}
      {#each $tocItems as item (item.id)}
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
      {/each}
    {:else}
      <div class="ml-9 p-4 text-center text-gray-500 border-2 border-black rounded-lg bg-gray-100">
        Use the AI generator or add items manually
      </div>
    {/if}
    <button
      on:click={addTocItem}
      class="ml-9 mt-3 mb-4 btn font-bold bg-yellow-400 text-black border-2 border-black rounded-lg px-4 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
    >
      Add New Section
    </button>
  </div>
</div>