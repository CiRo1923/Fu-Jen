<script>
import { saveScrollTo } from '../../scripts/_common.js';
import {
  j$, language, getFunctionCadeData, path, actionURL, listAllName, params
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
    },
    clickEvent: {
      type: Function,
      default: () => {}
    }
  },
  data() {
    return {
      language: language(),
      funCode: getFunctionCadeData(),
      listAllName: listAllName,
      listPath: path('listPath'),
      actionURL: actionURL,
      saveScrollTo: saveScrollTo,
      selectValue: Number(params('categoryId'))
    };
  },
  methods: {
    changeFun(e) {
      const vm = this;
      const $select = j$(e.currentTarget);
      const $options = $select.find('option');

      for (let i = 0; i < $options[0].length; i += 1) {
        const value = $options.eq(i).val();
        const url = $options.eq(i).attr('url');

        console.log(typeof Number(value));
        console.log(typeof vm.selectValue);

        if (Number(value) === Number(vm.selectValue)) {
          window.location.href = url;
        }
      }
    }
  }
};
</script>

<template>
  <div class="mMenu pt:h-full pt:bg-x1479 box-border pt:flex-shrink-0 p:px-56 p:py-32 t:px-32 t:py-20">
    <div class="mMenuHd p:mb-10 t:mb-5 m:hidden">
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
      class="mMenuBd p:space-y-10 t:space-y-5 m:hidden"
    >
      <li v-if="allLists">
        <a
          :href="actionURL(listPath, [`${funCode?.id}`, '0', '1'])"
          :class="{'text-xba79': !category, 'text-xf': category}"
          :title="(/en/.test(language) ? listAllName.englishName : listAllName.chineseName)"
          @click="saveScrollTo($event)"
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
    <footer
      v-if="Array.isArray(menu)"
      class="mMenuFt pt:hidden m:absolute"
    >
      <select
        v-model="selectValue"
        class="mMenuSelect w-full h-full border-1 border-solid border-x1479 rounded-8 bg-xf text-15"
        @change="changeFun($event)"
      >
        <optgroup :label="/en/.test(language) ? funCode.englishName : funCode.chineseName">
          <option
            v-if="allLists"
            value="0"
            :url="actionURL(listPath, [`${funCode?.id}`, '0', '1'])"
          >
            {{ /en/.test(language) ? listAllName.englishName : listAllName.chineseName }}
          </option>
          <option
            v-for="item, index in menu"
            :key="`menu_${index}`"
            :value="item.categoryId"
            :url="actionURL(listPath, [`functionCode-${funCode?.id}`, `listCategory-${item.categoryId}`, 'page-1'])"
          >
            {{ /en/.test(language) ? item.englishName : item.chineseName }}
          </option>
        </optgroup>
      </select>
    </footer>
  </div>
</template>
