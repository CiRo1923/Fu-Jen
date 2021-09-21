<script>
import { apiMenu, apiUserRoles } from '../scripts/_axios.js';
import {
  language, functionCode, path, actionURL
} from '../scripts/_factory.js';
import { ref } from 'vue';
import Svg from './Svg.vue';

export default {
  components: {
    'm-svg': Svg
  },
  props: {
    bgColor: {
      type: String,
      default: ''
    },
    textColor: {
      type: String,
      default: ''
    },
    svgColor: {
      type: String,
      default: ''
    }
  },
  setup() {
    let langText = ref(null);
    let langURL = ref(null);

    language((item, lang, text) => {
      langText = text;
      langURL = lang;
    });

    return {
      langText,
      langURL
    };
  },
  data() {
    return {
      language: language(),
      links: functionCode,
      actionURL: actionURL,
      listPath: path('listPath'),
      id: [],
      menu: [],
      isNav: null,
      isAct: false
    };
  },
  created() {
    const vm = this;
    let routeId = null;
    let routeName = null;

    const apiAsync = async () => {
      // 取得 所有身分別
      await apiUserRoles().then(res => {
        const { status, data } = res;
        if (status === 200) {
          const items = data.data.items;

          console.log(data);

          for (let i = 0; i < items.length; i += 1) {
            vm.id.push(items[i]);

            if (new RegExp(items[i].routeName).test(window.location.pathname)) {
              routeId = items[i].userRoleId;
              routeName = items[i].routeName;
            }
          }
        }
      });

      // 取得 選單
      await apiMenu({
        UserRoleId: routeId,
        UserRoleRouteName: routeName
      }).then(res => {
        const { data } = res;
        if (data.code === 200) {
          const items = data.data.items;

          console.log(items);

          for (let i = 0; i < items.length; i += 1) {
            vm.menu.push(items[i]);
          }
        }
      });
    };

    apiAsync().then(() => {
      vm.getMaxHeight();
      window.addEventListener('resize', vm.getMaxHeight);
    });
  },
  methods: {
    getRel(type) {
      return type === '_blank' ? 'noopener' : null;
    },
    getMaxHeight() {
      const vm = this;
      const $navMainSub = document.querySelectorAll(`.${vm.$refs.navMainSub.classList[0]}`);
      $navMainSub.forEach(item => {
        item.style.maxHeight = `${item.firstChild.clientHeight}px`;
      });
    }
  }
};
</script>

<template>
  <div
    class="mNav p:px-60 p:flex-grow p:flex p:items-center"
    :class="{'act': isAct}"
  >
    <div
      class="mNavMain tm:left-0 tm:w-full tm:overflow-hidden tm:z-10 tm:absolute p:h-full p:flex p:flex-grow p:flex-col-reverse t:px-48 m:px-32"
      :class="bgColor"
    >
      <nav class="p:h-1/2 p:flex p:items-start p:justify-end">
        <ul class="p:-mx-10 p:h-full p:flex p:items-center t:space-y-14 m:space-y-10">
          <li
            v-for="item, index in menu"
            :key="item.chineseName"
            class="mNavMainItem relative p:mx-10 p:h-full p:text-x1479 p:hover:text-x0"
            :class="[textColor, {'act': isNav === index}]"
          >
            <a
              v-if="(/en/.test(language) ? item.englishURL : item.chineseURL)"
              :href="(/en/.test(language) ? item.englishURL : item.chineseURL)"
              :title="(/en/.test(language) ? item.englishName : item.chineseName)"
              :target="/en/.test(language) ? item.englishactionURLType : item.chineseactionURLType"
              :rel="getRel((/en/.test(language) ? item.englishactionURLType : item.chineseactionURLType))"
              class="p:h-full block"
            >
              <em class="pt:text-20 m:text-18 not-italic"><strong>{{ /en/.test(language) ? item.englishName : item.chineseName }}</strong></em>
            </a>
            <button
              v-else
              type="button"
              class="w-full flex tm:items-center p:flex-col p:h-full"
              tabindex="-1"
              @click="isNav = index"
            >
              <em class="pt:text-20 m:text-18 not-italic"><strong>{{ /en/.test(language) ? item.englishName : item.chineseName }}</strong></em>
              <m-svg
                class="t:ml-8 m:ml-6 p:hidden"
                :class="svgColor"
                svg-icon="arrow_nav"
              />
            </button>
            <div
              ref="navMainSub"
              class="mNavMainSub overflow-hidden p:bg-xf2 p:absolute"
              :class="{'p:left-1/2': menu.length !== (index + 1)}"
            >
              <ul class="p:px-20 p:py-14 p:space-y-16 t:space-y-8 t:mt-8 m:space-y-3 m:mt-4">
                <li
                  v-for="sunItem in item.children"
                  :key="sunItem.chineseName"
                  class="mNavMainSubItem tm:text-xd0 p:text-x60 p:hover:text-x0 "
                >
                  <a
                    :href="(/en/.test(language) ? sunItem.englishURL : sunItem.chineseURL) || 'javascript:;'"
                    :title="(/en/.test(language) ? sunItem.englishName : sunItem.chineseName)"
                    :target="/en/.test(language) ? item.englishURLActionType : item.chineseURLActionType"
                    :rel="getRel((/en/.test(language) ? item.englishURLActionType : item.chineseURLActionType))"
                    class="whitespace-no-wrap text-center"
                  >
                    <em class="p:text-20 t:text-18 m:text-16 not-italic">{{ /en/.test(language) ? sunItem.englishName : sunItem.chineseName }}</em>
                  </a>
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </nav>
      <div class="p:mb-12 p:h-1/2 p:flex p:items-end p:justify-end t:mt-16 m:mt-12">
        <div class="mNavTools p:flex p:items-center tm:relative t:pt-16 m:pt-12">
          <p
            class="p:hidden t:text-20 m:text-18"
            :class="textColor"
          >
            <b>{{ /en/.test(language) ? 'Login' : '使用者登入' }}</b>
          </p>
          <div class="mNavId t:mt-8 t:mb-16">
            <ul class="flex items-center p:-mx-10 p:h-full tm:flex-wrap">
              <li
                v-for="item in id"
                :key="item.chineseName"
                class="p:px-10 t:w-1/5 m:w-1/2"
              >
                <a
                  :href="item.url || actionURL(null, [`userRoute-${item.routeName}`])"
                  :title="(/en/.test(language) ? item.englishName : item.chineseName)"
                  :target="item.isInternal ? null : '_blank'"
                  :rel="item.isInternal ? null : 'noopener'"
                  class="p:text-18 t:text-16 m:text-14 p:text-x057d"
                  :class="textColor"
                >
                  {{ /en/.test(language) ? item.englishName : item.chineseName }}
                </a>
              </li>
            </ul>
          </div>
          <div class="mNavLinks relative p:ml-24 p:px-24 p:py-4 p:bg-x1479 p:rounded-20 t:py-16 m:mt-12 m:py-12">
            <ul class="flex items-center tm:text-x1479 p:text-14 p:text-xf p:-mx-10 t:mx-auto t:w-1/2">
              <li
                v-for="item in links"
                :key="item.chineseName"
                class="mNavItem box-border relative p:px-10"
              >
                <a
                  class="box-border tm:text-center tm:flex tm:flex-col tm:justify-center t:px-16 t:text-15 m:px-12 m:text-13"
                  :href="actionURL(listPath, [item.id])"
                  :title="(/en/.test(language) ? item.englishName : item.chineseName)"
                >{{ /en/.test(language) ? item.englishName : item.chineseName }}</a>
              </li>
              <li class="mNavItem box-border relative p:px-10">
                <a
                  class="box-border tm:text-center tm:flex tm:flex-col tm:justify-center t:px-16 t:text-15 m:px-12 m:text-13"
                  :href="actionURL(null, [`language-${langURL}`])"
                  :title="langText"
                >{{ langText }}</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div class="mNavTools p:ml-28 flex-shrink-0 hidden">
      <button
        type="button"
        class="mNavSearch"
      >
        <m-svg
          class="w-full h-full fill-x1479"
          svg-icon="search"
        />
      </button>
    </div>
    <div class="mNavCtrl p:hidden tm:absolute">
      <button
        class="mNavCtrlBtn w-full h-full rounded-10 relative"
        :class="{'m:bg-xba79' : bgColor == 'm:bg-xf'}"
        type="button"
        :aria-label="/en/.test(language) ? 'OPEN MENU' : '打開選單'"
        @click="isAct = !isAct;"
      >
        <i>MENU</i>
      </button>
    </div>
  </div>
</template>
