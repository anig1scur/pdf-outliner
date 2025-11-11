<script>
  import {
    ChevronRight,
    ChevronDown,
    Plus,
    Trash,
    CircleHelpIcon,
  } from 'lucide-svelte';
  import Tooltip from '../components/Tooltip.svelte';
  import ShortUniqueId from 'short-unique-id';
  import Self from './TocItem.svelte';
  import { maxPage } from '../stores';
  import { createEventDispatcher } from 'svelte';
  export let item;
  export let onUpdate;
  export let onDelete;
  export let showTooltip;

  const dispatch = createEventDispatcher();
  
  $: editTitle = item ? item.title : '';

  function handleToggle() {
    item.open = !item.open;
    onUpdate(item, { open: item.open });
  }

  function handleUpdateTitle() {
    onUpdate(item, { title: editTitle });
  }

  function handlePageChange(e) {
    const page = parseInt(e.target.value) || 1;
    onUpdate(item, { to: page });
  }

  function handleAddChild() {
    const newChild = {
      id: new ShortUniqueId({ length: 10 }),
      title: 'New Item',
      to: $maxPage + 1,
      children: [],
      open: true,
    };

    const updatedChildren = [...(item.children || []), newChild];
    onUpdate(item, { children: updatedChildren });
  }

  function handleUpdateChild(childItem, updates) {
    const updatedChildren = item.children.map((child) =>
      child.id === childItem.id ? { ...child, ...updates } : child
    );
    onUpdate(item, { children: updatedChildren });
  }

  function handleDeleteChild(childItem) {
    const updatedChildren = item.children.filter((c) => c.id !== childItem.id);
    onUpdate(item, { children: updatedChildren });
  }

  function handleMouseEnter() {
    if (item) {
      dispatch('hoveritem', { to: item.to });
    }
  }
</script>

{#if item}
  <div class="ml-1">
    <div class="flex items-center gap-2 my-2" on:mouseenter={handleMouseEnter}>
      {#if item.children?.length > 0}
        {#if showTooltip}
          <Tooltip
            text={`This flag determines whether a PDF outline item is expanded or collapsed.

Only a few PDF viewer support it. Chrome collapses all items by default.`}
            position="right"
            className="-ml-6"
          >
            <CircleHelpIcon size={16} />
          </Tooltip>
        {/if}
        <button on:click={handleToggle} class="p-1 hover:bg-gray-100 rounded">
          {#if item.open}
            <ChevronDown size={16} />
          {:else}
            <ChevronRight size={16} />
          {/if}
        </button>
      {:else}
        <div class="w-6"></div>
      {/if}

      <input
        type="text"
        bind:value={editTitle}
        on:blur={handleUpdateTitle}
        on:keypress={(e) => e.key === 'Enter' && handleUpdateTitle()}
        class="border rounded px-2 py-1 text-sm myfocus"
      />

      <input
        type="number"
        bind:value={item.to}
        on:input={handlePageChange}
        class="w-16 border rounded px-2 py-1 text-sm myfocus"
        min="1"
      />

      <div class="flex gap-1">
        <button on:click={handleAddChild} class="p-1 hover:bg-gray-100 rounded">
          <Plus size={16} />
        </button>
        <button
          on:click={() => onDelete(item)}
          class="p-1 hover:bg-gray-100 rounded text-black"
        >
          <Trash size={16} />
        </button>
      </div>
    </div>

    {#if item.children && item.children.length > 0}
      <div class="ml-2">
        {#each item.children as child (child.id)}
          <Self
            item={child}
            showTooltip={false}
            onUpdate={handleUpdateChild}
            onDelete={handleDeleteChild}
            on:hoveritem
          />
        {/each}
      </div>
    {/if}
  </div>
{/if}