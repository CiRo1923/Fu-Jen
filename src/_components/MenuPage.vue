<script>
import mMenu from './_modules/mMenu.vue';

export default {
  components: {
    'm-menu': mMenu
  },
  props: {
    datas: {
      type: [Object, Array],
      default: () => {}
    }
  },
  data() {
    return {
      menu: [],
      category: null,
      pageItem: null
    };
  },
  created() {
    const vm = this;

    vm.menu = vm.datas.data;
  }
};
</script>

<template>
  <m-menu
    :menu="menu"
    :all-lists="false"
  >
    <template #menu_header>
      {{ datas.data.name }}
    </template>
  </m-menu>
</template>
