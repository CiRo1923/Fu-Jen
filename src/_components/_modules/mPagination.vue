<script>
import { saveScrollTo } from '../../scripts/_common.js';

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
    nowPage: {
      type: String,
      default: ''
    },
    pages: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      saveScrollTo: saveScrollTo
    };
  }
};
</script>

<template>
  <div class="mPagination">
    <ol class="inline-flex items-center">
      <li class="mPaginationItem pt:mx-10 m:mx-8">
        <a
          v-if="Number(nowPage) !== 1"
          :href="firstUrl"
          class="p-5 p:text-20 t:text-16 m:text-14 flex flex-col justify-items-center"
          @click="saveScrollTo"
        >
          &lt;&lt;
        </a>
        <i
          v-else
          class="p-5 p:text-20 t:text-16 m:text-14 flex flex-col justify-items-center text-xd0"
        >
          &lt;&lt;
        </i>
      </li>
      <li
        v-for="item in pages"
        :key="`list_${item.number}_${item.url}`"
        class="mPaginationItem pt:mx-10 m:mx-8 border-1 rounded-5"
        :class="{'border-xe2 text-x7e': item.number === Number(nowPage), 'border-x7e text-x76': item.number !== Number(nowPage)}"
      >
        <a
          :href="item.url"
          class="p-5 p:text-16 t:text-14 m:text-12 flex flex-col justify-center"
          @click="saveScrollTo"
        >
          {{ item.number }}
        </a>
      </li>
      <li class="mPaginationItem pt:mx-10 m:mx-8">
        <a
          v-if="Number(nowPage) !== pages.length"
          :href="lastUrl"
          class="p-5 p:text-20 t:text-16 m:text-14 flex flex-col justify-items-center"
          @click="saveScrollTo"
        >
          &gt;&gt;
        </a>
        <i
          v-else
          class="p-5 p:text-20 t:text-16 m:text-14 flex flex-col justify-items-center text-xd0"
        >
          &gt;&gt;
        </i>
      </li>
    </ol>
  </div>
</template>

<style>

</style>
