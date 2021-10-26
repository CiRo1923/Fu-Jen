<script>
export default {
  props: {
    firstUrl: {
      type: String,
      default: ''
    },
    lastUrl: {
      type: String,
      default: ''
    },
    pages: {
      type: Array,
      default: () => []
    }
  }
};
</script>

<template>
  <div class="mPagination">
    <ol class="inline-flex">
      <li class="pt:mx-10 m:mx-8">
        <a
          :href="firstUrl"
          class="p-5 p:text-20 t:text-16 m:text-14"
        >
          &lt;&lt;
        </a>
      </li>
      <li
        v-for="item in pages"
        :key="`list_${item.number}_${item.url}`"
        class="pt:mx-10 m:mx-8"
      >
        <a
          :href="item.url"
          class="p-5 p:text-20 t:text-16 m:text-14"
        >
          {{ item.number }}
        </a>
      </li>
      <li class="pt:mx-10 m:mx-8">
        <a
          :href="lastUrl"
          class="p-5 p:text-20 t:text-16 m:text-14"
        >
          &gt;&gt;
        </a>
      </li>
    </ol>
  </div>
</template>

<style>

</style>
