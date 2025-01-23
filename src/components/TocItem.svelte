<script>
  export let item;
  export let onUpdate;
  export let onDelete;

  const handleUpdate = (key, value) => {
    onUpdate(item.id, { [key]: value });
  };

  const handleDelete = () => {
    onDelete(item.id);
  };
</script>

<div class="toc-item">
  <input
    type="text"
    placeholder="标题"
    bind:value={item.title}
    on:input="{(e) => handleUpdate('title', e.target.value)}"
  />
  <input
    type="number"
    placeholder="页码"
    min="1"
    bind:value={item.page}
    on:input="{(e) => handleUpdate('page', parseInt(e.target.value, 10))}"
  />
  <button on:click="{handleDelete}">删除</button>
</div>

<style>
  .toc-item {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
    gap: 0.5rem;
  }
  input[type="text"] {
    flex: 1;
    padding: 0.5rem;
  }
  input[type="number"] {
    width: 70px;
    padding: 0.5rem;
  }
  button {
    padding: 0.5rem;
    background-color: #ff4d4d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  button:hover {
    background-color: #ff1a1a;
  }
</style>

