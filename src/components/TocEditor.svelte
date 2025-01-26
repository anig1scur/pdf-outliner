<script>
  import TocItem from './TocItem.svelte';
  import {tocItems, maxPage} from '../stores';
  import ShortUniqueId from 'short-unique-id';
  import Logo from '../assets/logo-dark.svelte';

  let text = `1 Food Categories I Love 1
2 Fruits 2
2.1 Strawberry 3
2.2 Pineapple 4
3 Vegetables 5
3.1 Basil 6
3.2 Pumpkin 6
4 Junk Food 7`;

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
        const id = new ShortUniqueId({length: 10});
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
        id: new ShortUniqueId({length: 10}),
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
          return {...currentItem, ...updates};
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
  <div class="flex items-center gap-6">
    <span class="text-3xl font-semibold">PDF Outliner</span>
    <Logo />
  </div>
  <div class="h-64">
    <textarea
      bind:value={text}
      class="w-full h-full border myfocus leading-6 rounded p-2 text-sm"
    ></textarea>
  </div>
  <div class="-ml-9">
    {#each $tocItems as item (item.id)}
      <TocItem
        {item}
        showTooltip={item.id === firstItemWithChildrenId}
        onUpdate={updateTocItem}
        onDelete={deleteTocItem}
      />
    {/each}
    <button
      on:click={addTocItem}
      class="ml-9 mt-2 mb-4 btn"
    >
      Add New Section
    </button>
  </div>
</div>
