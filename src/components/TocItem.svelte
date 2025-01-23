<script>
  import {ChevronRight, ChevronDown, Plus, Trash} from 'lucide-svelte';
  import ShortUniqueId from 'short-unique-id';
  import Self from './TocItem.svelte';

  export let item;
  export let onUpdate;
  export let onDelete;

  let editTitle = item.title;

  function handleToggle() {
    item.open = !item.open;
    onUpdate(item, {open: item.open});
  }

  function handleUpdateTitle() {
    onUpdate(item, {title: editTitle});
  }

  function handlePageChange(e) {
    const page = parseInt(e.target.value) || 1;
    onUpdate(item, {to: page});
  }

  function handleDeleteChild(childItem) {
    const updatedChildren = item.children.filter((c) => c !== childItem);
    onUpdate(item, {children: updatedChildren});
  }

  function handleAddChild() {
    const newChild = {
      id: new ShortUniqueId({length: 10}),
      title: 'New Item',
      to: 1,
      children: [],
      open: true,
    };

    const updatedChildren = [...(item.children || []), newChild];
    onUpdate(item, {children: updatedChildren});
  }

  function handleUpdateChild(childItem, updates) {
    const updatedChildren = item.children.map((child) => (child.id === childItem.id ? {...child, ...updates} : child));
    onUpdate(item, {children: updatedChildren});
  }
</script>

<div class="ml-4">
  <div class="flex items-center gap-2 my-2">
    {#if item.children?.length > 0}
      <button
        on:click={handleToggle}
        class="p-1 hover:bg-gray-100 rounded"
      >
        {#if item.open}
          <ChevronDown size={16} />
        {:else}
          <ChevronRight size={16} />
        {/if}
      </button>
    {:else}
      <div class="w-6" />
    {/if}

    <input
      type="text"
      bind:value={editTitle}
      on:blur={handleUpdateTitle}
      on:keypress={(e) => e.key === 'Enter' && handleUpdateTitle()}
      class="border rounded px-2 py-1 text-sm"
      autofocus
    />

    <input
      type="number"
      bind:value={item.to}
      on:input={handlePageChange}
      class="w-16 border rounded px-2 py-1 text-sm"
      min="1"
    />

    <div class="flex gap-1">
      <button
        on:click={handleAddChild}
        class="p-1 hover:bg-gray-100 rounded"
      >
        <Plus size={16} />
      </button>
      <button
        on:click={() => onDelete(item)}
        class="p-1 hover:bg-gray-100 rounded text-red-500"
      >
        <Trash size={16} />
      </button>
    </div>
  </div>

  {#if item.children && item.children.length > 0}
    <div class="ml-4">
      {#each item.children as child (child.id)}
        <Self
          item={child}
          onUpdate={handleUpdateChild}
          onDelete={handleDeleteChild}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .ml-4 {
    margin-left: 1rem;
  }
  .flex {
    display: flex;
  }
  .items-center {
    align-items: center;
  }
  .gap-1 {
    gap: 0.25rem;
  }
  .gap-2 {
    gap: 0.5rem;
  }
  .my-2 {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .p-1 {
    padding: 0.25rem;
  }
  .w-6 {
    width: 1.5rem;
  }
  .w-16 {
    width: 4rem;
  }
  .rounded {
    border-radius: 0.25rem;
  }
  .border {
    border: 1px solid #e2e8f0;
  }
  .text-sm {
    font-size: 0.875rem;
  }
  .text-red-500 {
    color: #ef4444;
  }
  .hover\:bg-gray-100:hover {
    background-color: #f3f4f6;
  }
  .bg-gray-200 {
    background-color: #e5e7eb;
  }
</style>
