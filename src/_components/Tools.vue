<script>
import mTools from './_modules/mTools.vue';
import Menu from './Menu.vue';
import Kv from './Kv.vue';

export default {
  components: {
    'm-tools': mTools,
    'm-menu': Menu,
    'm-kv': Kv
  },
  data() {
    return {
      isHome: (document.querySelector('[name="isHome"]').value === 'true')
    };
  }
};
</script>

<template>
  <m-tools>
    <template #tools_content>
      <m-menu v-if="!isHome" />
      <m-kv :class="{'--width': isHome, 'flex-grow': !isHome}" />
    </template>
  </m-tools>
</template>
