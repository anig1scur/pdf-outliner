<script lang="ts">
  export let tocStartPage: number;
  export let tocEndPage: number;
  export let totalPages: number;
</script>

<div class="border-black border-2 rounded-lg p-3 my-4 bg-blue-100 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
  <h3 class="font-bold mb-2">ToC Pages Selection</h3>
  <div class="flex gap-4 items-center my-2">
    <label
      for="toc_start_page"
      class="w-32">Start Page:</label
    >
    <input
      type="number"
      id="toc_start_page"
      bind:value={tocStartPage}
      min={1}
      max={totalPages}
      class="border-2 border-black rounded px-2 py-1 w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
  <div class="flex gap-4 items-center my-2">
    <label
      for="toc_end_page"
      class="w-32">End Page:</label
    >
    <input
      type="number"
      id="toc_end_page"
      bind:value={tocEndPage}
      min={tocStartPage}
      max={totalPages}
      class="border-2 border-black rounded px-2 py-1 w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
</div>
