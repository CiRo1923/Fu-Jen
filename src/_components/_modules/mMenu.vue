<script>
import {
  language, getFunctionCadeData, path, actionURL, listAllName
} from '../../scripts/_factory.js';

export default {
  props: {
    menu: {
      type: [Object, Array],
      default: () => {}
    },
    category: {
      type: [String, Number],
      default: ''
    },
    allLists: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      language: language(),
      funCode: getFunctionCadeData(),
      listAllName: listAllName,
      listPath: path('listPath'),
      actionURL: actionURL
    };
  }
};
</script>

<template>
  <div class="mMenu h-full bg-x1479 box-border p:px-56 p:py-32 t:px-32 t:py-20 m:hidden">
    <div class="mMenuHd p:mb-10 t:mb-5">
      <p
        class="p:text-30 t:text-20 text-xf"
      >
        <b>
          <slot name="menu_header" />
        </b>
      </p>
    </div>
    <ul
      v-if="Array.isArray(menu)"
      class="mMenuBd p:space-y-10 t:space-y-5"
    >
      <li v-if="allLists">
        <a
          :href="actionURL(listPath, [`${funCode?.id}`, '0', '1'])"
          :class="{'text-xba79': !category, 'text-xf': category}"
          :title="(/en/.test(language) ? listAllName.englishName : listAllName.chineseName)"
        >
          <em class="p:text-20 t:text-15 not-italic">{{ /en/.test(language) ? listAllName.englishName : listAllName.chineseName }}</em>
        </a>
      </li>
      <li
        v-for="item, index in menu"
        :key="`menu_${index}`"
      >
        <slot
          name="menu_content"
          :data="item"
        />
      </li>
    </ul>
  </div>
</template>
