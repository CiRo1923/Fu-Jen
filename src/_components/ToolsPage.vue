<script>
import mTools from './_modules/mTools.vue';
import MenuPage from './MenuPage.vue';
import Kv from './Kv.vue';

export default {
  components: {
    'm-tools': mTools,
    'm-menu-page': MenuPage,
    'm-kv': Kv
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
      <m-menu-page :datas="data" />
      <m-kv class="flex-grow" />
    </template>
  </m-tools>
</template>
