<script>
import { apiCategories, apiLinks } from '../scripts/_axios.js';
import { language, device } from '../scripts/_factory.js';
import Svg from './Svg.vue';
import { inject, reactive } from 'vue';

export default {
  components: {
    'm-svg': Svg
  },
  setup() {
    const info = inject('set');
    const social = reactive([]);
    const socialData = ['yt', 'ig', 'fb'];
    const socialName = ['youtube', 'instagram', 'facebook'];
    const sccialURL = ['youtubeURL', 'instagramURL', 'facebookURL'];

    for (let i = 0; i < socialData.length; i += 1) {
      social.push({
        icon: socialData[i],
        name: socialName[i],
        URL: info[sccialURL[i]]
      });
    }

    return {
      info,
      social
    };
  },
  data() {
    return {
      language: language(),
      links: [],
      isAct: null
    };
  },
  created() {
    const vm = this;

    const apiAsync = async () => {
      // 取得 所有身分別
      await apiCategories({
        FunctionCode: 'link'
      }).then(res => {
        const { status, data } = res;
        if (status === 200) {
          const items = data.data.items;

          for (let i = 0; i < items.length; i += 1) {
            vm.links.push(items[i]);
            vm.links[i].subLinks = [];
          }
        }
      });

      await apiLinks({
        CategoryId: null,
        UserRoleId: null
      }).then(resp => {
        const { status, data } = resp;

        if (status === 200) {
          const items = data.data.items;

          for (let i = 0; i < items.length; i += 1) {
            const { categoryId } = items[i];

            for (let j = 0; j < vm.links.length; j += 1) {
              const { categoryId: linksCategoryId } = vm.links[j];

              if (categoryId === linksCategoryId) {
                vm.links[j].subLinks.push(items[i]);
              }
            }
          }
        }
      });
    };

    apiAsync();
  },
  methods: {
    clickLinks(index) {
      const vm = this;

      if (device() === 'M') {
        if (vm.isAct !== null && vm.isAct === index) {
          vm.isAct = null;
        } else {
          vm.isAct = index;
        }
      }
    }
  }
};
</script>

<template>
  <footer class="mFt mx-auto overflow-hidden relative z-0 p:pt-76 p:pb-100 t:p-20 m:p-28">
    <a
      href="#Z"
      title="下方功能區塊"
      accesskey="Z"
      name="Z"
      class="assetsKey top-0 left-0 absolute"
    >:::</a>
    <div class="mFtLinks">
      <ul class="flex m:flex-wrap">
        <li
          v-for="item, index in links"
          :key="`${item.chineseName}_${index}`"
          class="mFtLinksItem pt:flex-1 m:w-1/2 m:mb-5"
          :class="{'act': isAct === index}"
        >
          <div class="mFtLinksItemHd p:mb-24 t:mb-12">
            <button
              type="button"
              class="mFtLinksItemCtrl text-xf pt:block m:w-full m:flex m:items-center m:justify-center m:text-center"
              :title="(/en/.test(language) ? item.englishName : item.chineseName)"
              @click="clickLinks(index)"
            >
              <b class="p:text-24 t:text-22 m:text-20">{{ /en/.test(language) ? item.englishName : item.chineseName }}</b>
              <div class="mFtLinksIconFrame ml-5 relative pt:hidden">
                <m-svg
                  class="mFtLinksIcon --plus top-0 left-0 fill-xf w-full h-full absolute"
                  svg-icon="plus"
                />
                <m-svg
                  class="mFtLinksIcon --minus top-0 left-0 fill-xf w-full h-full absolute"
                  svg-icon="minus"
                />
              </div>
            </button>
          </div>
          <div
            class="mFtLinksItemBd m:overflow-hidden m:text-center"
            :class="{'--delay': isAct !== null}"
          >
            <ul class="space-y-5 m:py-5 m:border-t-1 m:bordr-xf">
              <li
                v-for="subLink in item.subLinks"
                :key="subLink.chineseName"
              >
                <a
                  :href="(/en/.test(language) ? subLink.englishURL : subLink.chineseURL)"
                  class="text-xf p:text-18 t:text-16 m:text-14"
                  :title="(/en/.test(language) ? subLink.englishName : subLink.chineseName)"
                  target="_blank"
                  rel="noopener"
                >
                  {{ /en/.test(language) ? subLink.englishName : subLink.chineseName }}
                </a>
              </li>
            </ul>
          </div>
        </li>
      </ul>
    </div>
    <div class="p:pt-76 t:pt-28">
      <ul class="p:-mx-12 p:flex p:items-center">
        <li class="p:px-12 flex-grow flex pt:items-center t:mx-auto t:w-2/3 t:justify-between m:flex-col-reverse">
          <m-svg
            class="mFtLogo fill-xf w-full h-full p:mr-24 m:mx-auto"
            svg-icon="logo_footer"
          />
          <ul class="mFtSocial flex items-center p:-mx-10 m:mx-auto m:my-20 m:w-11/12 m:justify-between">
            <li
              v-for="item in social"
              :key="item.name"
              class="pt:px-10"
            >
              <a
                :href="item.URL"
                class="mFtSocialLink block"
                :title="item.name"
                target="_blank"
                rel="noopener"
              >
                <m-svg
                  class="fill-xf w-full h-full"
                  :svg-icon="item.icon"
                />
              </a>
            </li>
          </ul>
        </li>
        <li class="flex-shrink-0 p:px-12 p:text-right tm:mt-20 tm:text-center">
          <div class="pt:inline-flex pt:items-center p:text-16 m:mb-10 m:text-14">
            <p class="text-xf">
              {{ /en/.test(language) ? info.englishAddress : info.chineseAddress }}
            </p>
            <a
              class="p:ml-20 text-xf pt:inline-block"
              :href="`tel:${/en/.test(language) ? info.englishPhoneNumber : info.chinesePhoneNumber}`"
              :title="(/en/.test(language) ? info.englishPhoneNumber : info.chinesePhoneNumber)"
            >{{ /en/.test(language) ? info.englishPhoneNumber : info.chinesePhoneNumber }}</a>
          </div>
          <p class="text-xf opacity-35 p:text-14 t:text-13 m:text-12">
            {{ /en/.test(language) ? info.englishDeclare : info.chineseDeclare }}
          </p>
        </li>
      </ul>
    </div>
  </footer>
</template>
