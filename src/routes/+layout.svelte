<script lang="ts">
	import { onMount } from 'svelte';
	import { check } from '@tauri-apps/plugin-updater';
  import { relaunch } from '@tauri-apps/plugin-process';
  import '../app.css';
  import '../lib/i18n';
  import UpdateModal from '../components/modals/UpdateModal.svelte';
  import { isTauri } from '$lib/utils';

	let { children } = $props();

  let showUpdateModal = $state(false);
  let updateData = $state<{version: string; notes: string; date?: string} | null>(null);
  let updateObj: any = null;

  async function checkForUpdate() {
    try {
      if (!isTauri()) return;
      const update = await check();
      if (update?.available) {
          updateObj = update;
          updateData = {
              version: update.version,
              notes: update.body || '',
              date: update.date
          };
          showUpdateModal = true;
      }
    } catch (e) {
      console.error('Failed to check validation', e);
    }
  }

  async function handleUpdate() {
      if (updateObj) {
          await updateObj.downloadAndInstall();
          await relaunch();
      }
  }

  function handleCancel() {
      showUpdateModal = false;
  }

  onMount(() => {
     checkForUpdate().catch(e => console.warn('Update check failed:', e));
  });
</script>

{@render children()}
<UpdateModal 
  showUpdateModal={showUpdateModal}
  updateData={updateData}
  onUpdate={handleUpdate}
  onCancel={handleCancel}
/>
