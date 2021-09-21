<script>
import mTools from './_modules/mTools.vue';
import MenuNav from './MenuNav.vue';
import KvNav from './KvNav.vue';

export default {
  components: {
    'm-tools': mTools,
    'm-menu-nav': MenuNav,
    'm-kv': KvNav
  },
  inject: {
    data: {
      type: Object,
      default: () => {}
    }
  }
};
</script>

<template>
  <m-tools>
    <template #tools_content>
      <m-menu-nav :datas="data" />
      <m-kv
        :datas="data"
        class="flex-grow"
      />
    </template>
  </m-tools>
</template>
