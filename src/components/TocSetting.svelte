<script lang="ts">
  import {createEventDispatcher} from 'svelte';
  import {slide} from 'svelte/transition';
  import {Eye, EyeOff} from 'lucide-svelte';
  import { t } from 'svelte-i18n';
  import type {TocConfig} from '../stores';

  export let isTocConfigExpanded: boolean;
  export let addPhysicalTocPage: boolean;
  export let config: TocConfig;
  export let previewPdfInstance: any;

  const dispatch = createEventDispatcher();

  function updateField(path: string, value: any) {
    dispatch('updateField', {path, value});
  }
</script>

<div class="border-black border-2 rounded-lg p-2 my-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] bg-white">
  <div class="flex justify-between items-center">
    <h2>{$t('settings.title')}</h2>
    <button
      class="w-6 h-6 flex items-center justify-center"
      on:click={() => dispatch('toggleExpand')}
      aria-label={$t('settings.toggle_expand')} 
    >
      {#if isTocConfigExpanded}
        <Eye class="text-gray-700" />
      {:else}
        <EyeOff class="text-gray-500" />
      {/if}
    </button>
  </div>
  {#if isTocConfigExpanded}
    <div
      class="mt-3"
      transition:slide={{duration: 200}}
    >
      <div class="border-black border-2 rounded-md my-1 p-2 w-full">
        <input
          bind:checked={addPhysicalTocPage}
          type="checkbox"
          id="add_physical_page"
        />
        <label for="add_physical_page">{$t('settings.add_physical_page')}</label>
      </div>
      {#if addPhysicalTocPage}
        <div class="border-black border-2 rounded-md my-2 p-2 w-full">
          <div class="flex gap-2 items-center">
            <label
              class="whitespace-nowrap text-sm"
              for="insert_at_page">{$t('settings.insert_at_page')}</label
            >
            <input
              type="number"
              id="insert_at_page"
              value={config.insertAtPage || 2}
              on:input={(e) => updateField('insertAtPage', parseInt(e.target.value, 10) || 2)}
              class="w-20 border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={1}
            />
            <button
              on:click={() => dispatch('jumpToTocPage')}
              class="ml-auto px-2 py-0.5 bg-white text-black border-2 border-black rounded-md shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-sm"
              title={$t('tooltip.jump_toc')}
              disabled={!previewPdfInstance}
            >
              {$t('btn.go')}
            </button>
          </div>
          <div class="text-xs text-gray-500 mt-1">{$t('settings.insert_at_page_hint')}</div>
        </div>
      {/if}
      <div class="border-black border-2 rounded-md my-1 p-2 w-full">
        <input
          checked={config.showNumberedList}
          type="checkbox"
          id="show_numbered_list"
          on:change={(e) => updateField('showNumberedList', e.target.checked)}
        />
        <label for="show_numbered_list">{$t('settings.with_numbered_list')}</label>
      </div>
      <div class="border-black border-2 rounded-md my-2 p-2 w-full">
        <div class="flex gap-2 items-center">
          <label
            class="whitespace-nowrap text-sm"
            for="page_offset">{$t('settings.page_offset')}</label
          >
          <input
            type="number"
            id="page_offset"
            value={config.pageOffset}
            on:input={(e) => updateField('pageOffset', parseInt(e.target.value, 10) || 0)}
            class="w-20 border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="text-xs text-gray-500 mt-1">{$t('settings.offset_hint')}</div>
      </div>
      <div class="flex flex-col md:flex-row gap-4">
        <div class="w-full md:w-1/2">
          <h3 class="my-4 font-bold">{$t('settings.first_level')}</h3>
          <div class="border-black border-2 rounded-md my-3 p-2 w-full">
            <label for="first_level_font_size">{$t('settings.font_size')}</label>
            <input
              type="number"
              id="first_level_font_size"
              value={config.firstLevel.fontSize}
              on:input={(e) => updateField('firstLevel.fontSize', parseInt(e.target.value, 10) || 0)}
              class="w-[80%] border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="border-black border-2 rounded-md my-3 p-2 w-full">
            <label for="first_level_dot_leader">{$t('settings.dot_leader')}</label>
            <input
              type="text"
              id="first_level_dot_leader"
              value={config.firstLevel.dotLeader}
              on:input={(e) => updateField('firstLevel.dotLeader', e.target.value)}
              class="w-[80%] border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="border-black border-2 rounded-md my-3 p-2 w-full">
            <label for="first_level_color">{$t('settings.color')}</label>
            <input
              type="color"
              id="first_level_color"
              value={config.firstLevel.color}
              on:input={(e) => updateField('firstLevel.color', e.target.value)}
              class="w-[80%]"
            />
          </div>
          <div class="border-black border-2 rounded-md my-3 p-2 w-full">
            <label for="first_level_line_spacing">{$t('settings.spacing')}</label>
            <input
              type="number"
              step="0.1"
              id="first_level_line_spacing"
              value={config.firstLevel.lineSpacing}
              on:input={(e) => updateField('firstLevel.lineSpacing', parseFloat(e.target.value) || 1)}
              class="w-[80%] border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div class="w-full md:w-1/2">
          <h3 class="my-4 font-bold">{$t('settings.other_levels')}</h3>
          <div class="border-black border-2 rounded-md my-3 p-2 w-full">
            <label for="other_levels_font_size">{$t('settings.font_size')}</label>
            <input
              type="number"
              id="other_levels_font_size"
              value={config.otherLevels.fontSize}
              on:input={(e) => updateField('otherLevels.fontSize', parseInt(e.target.value, 10) || 0)}
              class="w-[80%] border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="border-black border-2 rounded-md my-3 p-2 w-full">
            <label for="other_levels_dot_leader">{$t('settings.dot_leader')}</label>
            <input
              type="text"
              id="other_levels_dot_leader"
              value={config.otherLevels.dotLeader}
              on:input={(e) => updateField('otherLevels.dotLeader', e.target.value)}
              class="w-[80%] border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="border-black border-2 rounded-md my-3 p-2 w-full">
            <label for="other_levels_color">{$t('settings.color')}</label>
            <input
              type="color"
              id="other_levels_color"
              value={config.otherLevels.color}
              on:input={(e) => updateField('otherLevels.color', e.target.value)}
              class="w-[80%]"
            />
          </div>
          <div class="border-black border-2 rounded-md my-3 p-2 w-full">
            <label for="other_levels_line_spacing">{$t('settings.spacing')}</label>
            <input
              type="number"
              step="0.1"
              id="other_levels_line_spacing"
              value={config.otherLevels.lineSpacing}
              on:input={(e) => updateField('otherLevels.lineSpacing', parseFloat(e.target.value) || 1)}
              class="w-[80%] border-2 border-black rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>