<script>
  import {ChevronRight, ChevronDown, Plus, Trash, GripVertical} from 'lucide-svelte';
  import ShortUniqueId from 'short-unique-id';
  import Self from './TocItem.svelte';
  import {maxPage} from '../stores';
  import {createEventDispatcher} from 'svelte';
  import {t} from 'svelte-i18n';
  import {dndzone} from 'svelte-dnd-action';
  import {flip} from 'svelte/animate';

  export let item;
  export let onUpdate;
  export let onDelete;
  export let onDragStart = () => {};
  export let onDragEnd = () => {};


  export let currentPage = 1;
  export let isPreview = false;
  export let pageOffset = 0;
  export let insertAtPage = 2;
  export let tocPageCount = 0;

  const dispatch = createEventDispatcher();
  const flipDurationMs = 200;

  let editTitle = item ? item.title : '';
  let editPage = item ? item.to : 1;
  let isFocused = false;
  let isPageFocused = false;

  $: if (item && !isFocused && item.title !== editTitle) {
    editTitle = item.title;
  }

  $: if (item && !isPageFocused && item.to !== editPage) {
    editPage = item.to;
  }

  $: physicalContentPage = item.to + pageOffset;
  $: targetPageInPreview =
    physicalContentPage >= insertAtPage ? physicalContentPage + tocPageCount : physicalContentPage;

  $: isActive = isPreview && currentPage === targetPageInPreview;

  function handleToggle() {
    item.open = !item.open;
    onUpdate(item, {open: item.open});
  }

  function handleUpdateTitle() {
    onUpdate(item, {title: editTitle});
  }

  function handleUpdatePage() {
    const val = parseInt(editPage);
    const page = isNaN(val) ? 1 : val;
    if (page !== item.to) {
      onUpdate(item, {to: page});
    }
  }

  function handleAddChild() {
    const newChild = {
      id: new ShortUniqueId({length: 10}),
      title: $t('toc.new_item_default') || 'New Item',
      to: $maxPage + 1,
      children: [],
      open: true,
    };
    const updatedChildren = [...(item.children || []), newChild];
    onUpdate(item, {children: updatedChildren, open: true});
  }

  function handleUpdateChild(childItem, updates, skipHistory = false) {
    const updatedChildren = (item.children || []).map((child) =>
      child.id === childItem.id ? {...child, ...updates} : child,
    );
    onUpdate(item, {children: updatedChildren}, skipHistory);
  }

  function handleDeleteChild(childItem) {
    const updatedChildren = (item.children || []).filter((c) => c.id !== childItem.id);
    onUpdate(item, {children: updatedChildren});
  }

  function handleMouseEnter() {
    if (item) {
      dispatch('hoveritem', {to: item.to});
    }
  }

  function handleDndConsider(e) {
    onDragStart();
    item.children = e.detail.items;
    item = item;
  }

  function handleDndFinalize(e) {
    item.children = e.detail.items;
    item = item;
    onUpdate(item, {children: item.children}, true);
    onDragEnd();
  }
</script>

{#if item}
  <div>
    <div
      class="flex items-center gap-1 py-1.5 rounded-md group"
      on:mouseenter={handleMouseEnter}
      class:bg-blue-200={isActive}
      class:font-bold={isActive}
    >
      <div
        class="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-400 -mr-1 transition-opacity"
      >
        <GripVertical size={16} />
      </div>

      <button
        on:click={handleToggle}
        class=" hover:bg-gray-200 rounded-md text-gray-500"
        class:invisible={!item.children || item.children.length === 0}
        title="Toggle"
      >
        {#if item.open}
          <ChevronDown size={16} />
        {:else}
          <ChevronRight size={16} />
        {/if}
      </button>

      <input
        type="text"
        bind:value={editTitle}
        on:focus={() => (isFocused = true)}
        on:blur={() => {
          isFocused = false;
          handleUpdateTitle();
        }}
        on:keypress={(e) => e.key === 'Enter' && e.target.blur()}
        class="border-2 border-black rounded px-2 py-1 text-sm myfocus focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[100px]"
      />

      <input
        type="number"
        bind:value={editPage}
        on:focus={() => (isPageFocused = true)}
        on:blur={() => {
          isPageFocused = false;
          handleUpdatePage();
        }}
        on:keypress={(e) => e.key === 'Enter' && e.target.blur()}
        class="w-14 border-2 border-black rounded ml-1 pl-1.5 py-1 text-sm myfocus focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div class="flex gap-1">
        <button
          on:click={handleAddChild}
          class="p-1 hover:bg-gray-200 rounded-md"
          title="Add Child"
        >
          <Plus size={16} />
        </button>
        <button
          on:click={() => onDelete(item)}
          class="p-1 hover:bg-gray-200 rounded-md text-black"
          title="Delete"
        >
          <Trash size={16} />
        </button>
      </div>
    </div>

    {#if item.open}
      <div
        class="ml-6 pl-2 border-transparent hover:border-gray-200 transition-colors"
        use:dndzone={{
          items: item.children || [],
          flipDurationMs,
          dropTargetStyle: item.children?.length > 0 ? {outline: '2px dashed #000', borderRadius: '4px'} : {},
        }}
        on:consider={handleDndConsider}
        on:finalize={handleDndFinalize}
      >
        {#each item.children || [] as child (child.id)}
          <div animate:flip={{duration: flipDurationMs}}>
            <Self
              item={child}
              onUpdate={handleUpdateChild}
              onDelete={handleDeleteChild}
              {onDragStart}
              {onDragEnd}
              on:hoveritem
              {currentPage}
              {isPreview}
              {pageOffset}
              {insertAtPage}
              {tocPageCount}
            />
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
