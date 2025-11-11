<script>
  import ShortUniqueId from 'short-unique-id';
  import { CircleHelpIcon } from 'lucide-svelte';
  import TocItem from './TocItem.svelte';
  import Tooltip from './Tooltip.svelte';
  import { tocItems, maxPage } from '../stores';

  //   let text = `1 Food Categories I Love 1
  // 2 Fruits 2
  // 2.1 Strawberry 3
  // 2.2 Pineapple 4
  // 3 Vegetables 5
  // 3.1 Basil 6
  // 3.2 Pumpkin 6
  // 4 Junk Food 7`;

  let text = ``;
  function parseText(text) {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const items = [];
    const stack = [{ level: 0, item: { children: items } }];

    lines.forEach((line) => {
      const match = line.match(/^(\d+(?:\.\d+)*)\s+(.+?)\s+(\d+)$/);
      if (match) {
        const id = new ShortUniqueId({ length: 10 });
        const [, number, title, pageStr] = match;
        const level = number.split('.').length;
        const page = parseInt(pageStr);
        const newItem = {
          id,
          title: title,
          to: page,
          children: [],
          open: true,
        };

        if (page > $maxPage) {
          $maxPage = page;
        }

        while (stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        stack[stack.length - 1].item.children.push(newItem);
        stack.push({ level, item: newItem });
      }
    });

    return items;
  }

  function generateText(items, prefix = '') {
    return items
      .map((item, index) => {
        const number = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
        let text = `${number} ${item.title} ${item.to}`;

        if (item.children && item.children.length > 0) {
          text += '\n' + generateText(item.children, number);
        }

        return text;
      })
      .join('\n');
  }

  // FIXME: currently tocItem sync to text will loop!!

  $: {
    $tocItems = parseText(text);
  }

  $: firstItemWithChildrenId = (() => {
    const findFirst = (items) => {
      for (const item of items) {
        if (item.children?.length > 0) {
          return item.id;
        }
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
        id: new ShortUniqueId({ length: 10 }),
        title: 'New Section',
        to: $maxPage + 1,
        children: [],
        open: true,
      },
    ];
    text = generateText($tocItems);
  };

  const updateTocItem = (item, updates) => {
    const updateItemRecursive = (items) => {
      return items.map((currentItem) => {
        if (currentItem === item) {
          return { ...currentItem, ...updates };
        }
        if (currentItem.children?.length) {
          return {
            ...currentItem,
            children: updateItemRecursive(currentItem.children),
          };
        }
        return currentItem;
      });
    };

    $tocItems = updateItemRecursive($tocItems);
    text = generateText($tocItems);
  };

  const deleteTocItem = (itemToDelete) => {
    const deleteItemRecursive = (items) => {
      return items.filter((item) => {
        if (item === itemToDelete) {
          return false;
        }
        if (item.children?.length) {
          item.children = deleteItemRecursive(item.children);
        }
        return true;
      });
    };

    $tocItems = deleteItemRecursive($tocItems);
    text = generateText($tocItems);
  };
</script>

<div class="flex flex-col gap-4">
  <div class="h-64 relative">
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
      class="w-full h-full border myfocus leading-6 rounded p-2 text-sm border-gray-100"
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
        />
      {/each}
    {:else}
      <div
        class="ml-9 p-4 text-center text-gray-500 border-2 border-dashed border-gray-100 rounded-lg"
      >
        <p class="text-sm font-medium">
          Your Table of Contents will appear here.
        </p>
        <p class="text-xs">
          Use the AI generator or add an item manually to start.
        </p>
      </div>
    {/if}
    <button on:click={addTocItem} class="ml-9 mt-2 mb-4 btn">
      Add New Section
    </button>
  </div>
</div>