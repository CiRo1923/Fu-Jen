<script>
import Svg from './Svg.vue';
import Nav from './Nav.vue';
import { language, actionURL, getImageSrc } from '../scripts/_factory.js';
import { inject } from 'vue';

export default {
  components: {
    'm-svg': Svg,
    'm-nav': Nav
  },
  setup() {
    const info = inject('set');

    return {
      info
    };
  },
  data() {
    return {
      isHome: !!document.querySelector('#home'),
      language: language(),
      actionURL: actionURL
    };
  },
  created() {
    const vm = this;

    switch (vm.info.colorTheme) {
      case 1:
        vm.info.styleClass = 'bg-xb139 pt:border-xb139 text-xf';
        vm.info.tabletClass = 't:bg-xb139';
        vm.info.logoClass = 'fill-xf';
        vm.info.navBgClass = 'tm:bg-xb139';
        vm.info.navTextClass = 'tm:text-xf';
        break;
      case 2:
        vm.info.styleClass = 'bg-x057d pt:border-x057d text-xf';
        vm.info.tabletClass = 't:bg-x057d';
        vm.info.logoClass = 'fill-xf';
        vm.info.navBgClass = 'tm:bg-x057d';
        vm.info.navTextClass = 'tm:text-xf';
        break;
      case 3:
        vm.info.styleClass = 'bg-xf pt:border-xdca1 text-xba79';
        vm.info.tabletClass = 't:bg-xf';
        vm.info.logoClass = 'fill-xba79';
        vm.info.navBgClass = 'tm:bg-xf';
        vm.info.navTextClass = 'tm:text-xba79';
        break;
      case 4:
        vm.info.styleClass = 'bg-xba79 pt:border-xba79 text-xf';
        vm.info.tabletClass = 't:bg-xba79';
        vm.info.logoClass = 'fill-xf';
        vm.info.navBgClass = 'tm:bg-xba79';
        vm.info.navTextClass = 'tm:text-xf';
        break;
      default:
        break;
    }
  },
  methods: {
    changeColor(color) {
      const vm = this;

      return vm.isHome ? color : 'text-x1479';
    },
    logoPath(item) {
      return getImageSrc(item.logoFilePath);
    }
  }
};
</script>

<template>
  <div
    class="mHd box-border p:flex"
    :class="{'p:items-center': !isHome}"
  >
    <a
      href="#U"
      title="上方功能區塊"
      accesskey="U"
      name="U"
      class="assetsKey top-0 left-0 absolute"
    >:::</a>
    <header
      class="mHdCnt p:flex-shrink-0"
      :class="{'--width': isHome}"
    >
      <h1 class="sr-only">
        天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY
      </h1>
      <div
        class="mHdLogo p:text-center t:px-20 t:py-5 m:px-12 m:py-10"
        :class="[{'--large p:pt-32 p:border-1' : isHome, 'flex-shrink-0 tm:bg-x1479': !isHome}, changeColor(info.styleClass)]"
      >
        <div>
          <a
            v-if="isHome"
            class="mHdLogoFrame p:mx-auto p:mb-84 inline-block relative"
            :href="actionURL('index')"
            title="天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
          >
            <m-svg
              v-if="!/en/.test(language)"
              class="tm:hidden w-full h-full"
              :class="changeColor(info.logoClass)"
              svg-icon="logo_large"
              alt="天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY"
            />
            <m-svg
              v-else
              class="tm:hidden w-full h-full"
              :class="changeColor(info.logoClass)"
              svg-icon="logo_large_en"
              alt="天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY"
            />
            <m-svg
              v-if="!/en/.test(language)"
              class="w-full h-full p:hidden m:hidden"
              :class="changeColor(info.logoClass)"
              svg-icon="logo"
              alt="天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
            />
            <m-svg
              v-else
              class="w-full h-full p:hidden m:hidden"
              :class="changeColor(info.logoClass)"
              svg-icon="logo_en"
              alt="天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
            />
            <m-svg
              class="w-full h-full pt:hidden"
              :class="changeColor(info.logoClass)"
              svg-icon="logo_mobile"
              alt="天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY"
            />
          </a>
          <div
            v-if="isHome"
            class="mHdPhotoFrame p:left-0 absolute"
          >
            <figure class="mHdFig w-full h-full relative p:overflow-hidden">
              <img
                class="pt:top-0 p:right-0 p:absolute"
                :src="logoPath(info)"
                alt="天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY"
                tabindex="-1"
              >
            </figure>
          </div>
          <a
            v-if="!isHome"
            class="mHdLogoFrame inline-block"
            :href="actionURL('index')"
            title="天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
          >
            <m-svg
              v-if="!/en/.test(language)"
              class="w-full h-full p:mx-auto p:fill-x1479 t:fill-xf m:hidden"
              svg-icon="logo"
              alt="天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
            />
            <m-svg
              v-else
              class="w-full h-full p:mx-auto p:fill-x1479 t:fill-xf m:hidden"
              svg-icon="logo_en"
              alt="天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
            />
            <m-svg
              class="w-full h-full m:fill-xf pt:hidden"
              svg-icon="logo_mobile"
              alt="天主教輔仁大學 FUJEN CATHOLIC UNIVERSITY:回首頁"
            />
          </a>
        </div>
      </div>
    </header>
    <m-nav
      :bg-color="isHome ? info.navBgClass : 'tm:bg-x1479'"
      :text-color="isHome ? info.navTextClass : 'tm:text-xf'"
      :svg-color="isHome ? info.logoClass : 'tm:fill-xf'"
    />
  </div>
</template>
