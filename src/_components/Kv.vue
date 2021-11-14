<script>
import { apiPpagepictures } from '../scripts/_axios.js';
import mBanner from './_modules/mBanner.vue';
import { language, path, getImageSrc } from '../scripts/_factory.js';

export default {
  components: {
    'm-banner': mBanner
  },
  data() {
    const vm = this;

    return {
      language: language(),
      imgPath: path('apiPath'),
      items: [],
      dasharray: 0,
      interval: null,
      slideOptions: {
        watchOverflow: true,
        autoplay: {
          delay: 8000,
          waitForTransition: false,
          disableOnInteraction: false
        },
        slidesPerView: 1,
        nav: true,
        effect: 'fade',
        navigation: {
          prevEl: '.mKvPrev',
          nextEl: '.mKvNext'
        },
        on: {
          slideChange() {
            vm.runSvgPath();
          }
        }
      }
    };
  },
  created() {
    const vm = this;

    const apiAsync = async () => {
      // 取得 Kv 輪播
      await apiPpagepictures({
        UserRoleId: null
      }).then(res => {
        const { status, data } = res;

        if (status === 200) {
          const items = data.data.items;

          console.log(data);

          vm.items = items;
        }
      });
    };

    apiAsync();
  },
  mounted() {
    const vm = this;

    vm.runSvgPath();
  },
  methods: {
    getSrc(item) {
      const vm = this;
      let src = null;

      if (/en/.test(vm.language.toLowerCase()) && item.englishFilePath) {
        src = getImageSrc(item.englishFilePath);
      } else if (/tw/.test(vm.language.toLowerCase()) && item.chineseFilePath) {
        src = getImageSrc(item.chineseFilePath);
      }

      // console.log(item.chinesePicturePath);

      return src;
    },
    runSvgPath() {
      const vm = this;
      let time = 0;
      const calcTime = 10;
      const svgPath = () => {
        vm.dasharray = 0;
        window.clearInterval(vm.interval);
        vm.interval = setInterval(() => {
          time += calcTime;
          if (time >= vm.slideOptions.autoplay.delay) {
            time = 0;

            svgPath();
          } else {
            vm.dasharray += ((calcTime / vm.slideOptions.autoplay.delay) * 100);
          }
        }, calcTime);
      };

      if (vm.slideOptions.autoplay?.delay) {
        svgPath();
      }
    }
  }
};
</script>

<template>
  <div class="mKv h-full overflow-hidden">
    <m-banner
      :key="`mKv${items.length}`"
      name="mKv"
      :items="items"
      :options="slideOptions"
      class="relative"
    >
      <template #slider_content="{ data }">
        <a
          :href="(/en/.test(language) ? data.englishURL : data.chineseURL)"
          class="mKvCtrl block w-full overflow-hidden relative"
          :target="/en/.test(language) ? data.englishURLActionType : data.chineseURLActionType"
          :title="(/en/.test(language) ? data.englishDescription : data.chineseDescription)"
        >
          <!-- eslint-disable vue/no-v-html -->
          <p
            class="mKvTitle p:text-44 t:text-28 m:text-20 text-xf absolute"
            v-html="(/en/.test(language) ? data.englishDescription : data.chineseDescription)"
          />
          <!--eslint-enable-->
          <figure class="mKvFig top-1/2 left-1/2 flex justify-center absolute">
            <img
              class="max-h-full"
              :src="getSrc(data)"
              :alt="(/en/.test(language) ? data.englishDescription : data.chineseDescription)"
            >
          </figure>
        </a>
      </template>
      <template #slider_nav>
        <svg
          viewBox="0 0 36 36"
          class="mKvCir top-0 left-0 w-full h-full absolute"
        >
          <path
            class="mKvPath top-0 left-0 absolute "
            :stroke-dasharray="`${dasharray}, 100`"
            d="M18 2a 16 16 0 0 1 0 32a 16 16 0 0 1 0 -32"
          />
        </svg>
      </template>
    </m-banner>
  </div>
</template>
