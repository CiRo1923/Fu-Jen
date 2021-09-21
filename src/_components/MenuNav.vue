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

    vm.menu = vm.datas.data.menuPage.menuPageItems;
  }
};
</script>

<template>
  <m-menu
    :menu="menu"
    :all-lists="false"
  >
    <template #menu_header>
      {{ datas.data.menuPage.menuPageName }}
    </template>
    <template #menu_content="{ data }">
      <a
        :href="data.menuPageItemURL"
        :class="{'text-xba79': datas.data.name === data.menuPageItemName, 'text-xf': datas.data.name !== data.menuPageItemName}"
        :title="data.menuPageItemName"
      >
        <em class="p:text-20 t:text-15 not-italic">{{ data.menuPageItemName }}</em>
      </a>
    </template>
  </m-menu>
</template>
