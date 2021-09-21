<script>
import { language, actionURL } from '../scripts/_factory.js';

export default {
  props: {
    path: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      language: language(),
      actionURL: actionURL,
      breadCrumbs: []
    };
  }
};
</script>

<template>
  <div class="mBreadCrumbs p:mb-48 t:mb-16 m:hidden">
    <ol class="flex items-center">
      <li class="mBreadCrumbsItem flex items-center p:text-20 t:text-14 relative">
        <a :href="actionURL('index')">
          {{ /en/.test(language) ? 'Home' : '首頁' }}
        </a>
      </li>
      <li
        v-for="item, index in path"
        :key="`${item}_${index}`"
        class="mBreadCrumbsItem flex items-center p:text-20 t:text-14 relative"
      >
        <a
          v-if="item?.split('-')[1]"
          class="inline-block"
          :href="item?.split('-')[1]"
        >
          {{ item?.split('-')[0] }}
        </a>
        <em
          v-else
          class="not-italic inline-block"
        >
          {{ item?.split('-')[0] }}
        </em>
      </li>
    </ol>
  </div>
</template>
