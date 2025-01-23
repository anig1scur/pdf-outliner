<script>
  import TocItem from './TocItem.svelte';
  import {tocItems} from "../stores";

  const addTocItem = () => {
    $tocItems = [
      ...$tocItems,
      {
        title: 'New Section',
        to: 1,
        italic: false,
        bold: false,
        children: [],
        open: true,
      },
    ];
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
  };

</script>

<div class="sidebar p-4 w-[30%]">
  <button on:click={addTocItem}>Add a New Item</button>

  {#each $tocItems as item, idx (idx)}
    <TocItem
      {item}
      onUpdate={updateTocItem}
      onDelete={deleteTocItem}
    />
  {/each}

</div>
