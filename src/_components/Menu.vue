<script>
import mMenu from './_modules/mMenu.vue';
import {
  language, params, getFunctionCadeData, path, actionURL
} from '../scripts/_factory.js';

export default {
  components: {
    'm-menu': mMenu
  },
  inject: {
    data: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      language: language(),
      funCode: getFunctionCadeData(),
      menu: [],
      categoryId: new RegExp(path('listPath')).test(window.location.pathname) ? 'listCategory' : 'articleCategory',
      category: Number(params(new RegExp(path('listPath')).test(window.location.pathname) ? 'listPath' : 'categoryId')),
      listPath: path('listPath'),
      actionURL: actionURL
    };
  }
};
</script>

<template>
  <m-menu
    :menu="data.data.items"
    :category="category"
  >
    <template #menu_header>
      {{ /en/.test(language) ? funCode.englishName : funCode.chineseName }}
    </template>
    <template #menu_content="{ data }">
      <a
        :href="actionURL(listPath, [`functionCode-${funCode?.id}`, `${categoryId}-${data.categoryId}`])"
        :class="{'text-xba79': category === data.categoryId, 'text-xf': category !== data.categoryId}"
        :title="(/en/.test(language) ? data.englishName : data.chineseName)"
      >
        <em class="p:text-20 t:text-15 not-italic">{{ /en/.test(language) ? data.englishName : data.chineseName }}</em>
      </a>
    </template>
  </m-menu>
</template>
