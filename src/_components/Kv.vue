<script>
import { apiPpagepictures } from '../scripts/_axios.js';
import mSlider from './_modules/mSlider.vue';
import Svg from './Svg.vue';
import { language, path, getImageSrc } from '../scripts/_factory.js';

export default {
  components: {
    'm-slider': mSlider,
    'm-svg': Svg
  },
  data() {
    return {
      language: language(),
      imgPath: path('apiPath'),
      items: []
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
  methods: {
    getImg(data) {
      const vm = this;
      let src = '/static/img/banner.jpg';

      if (process.env.APP_ENV !== 'dev') {
        src = /en/.test(vm.language) ? getImageSrc(data.englishFilePath) : getImageSrc(data.chineseFilePath);
      }

      return src;
    }
  }
};
</script>

<template>
  <div class="mKv h-full overflow-hidden">
    <m-slider
      :key="`mkv${items.length}`"
      name="mkv"
      :items="items"
      :options="{'items': 1, 'axis': 'vertical', 'autoplay': true}"
      class="relative"
    >
      <template #slider_content="{ data }">
        <a
          :href="(/en/.test(language) ? data.englishURL : data.chineseURL)"
          class="mKvCtrl block w-full overflow-hidden relative"
          :target="/en/.test(language) ? data.englishURLActionType : data.chineseURLActionType"
          :title="(/en/.test(language) ? data.englishDescription : data.chineseDescription)"
        >
          <p class="mKvTitle p:text-44 t:text-28 m:text-20 text-xf absolute">
            {{ /en/.test(language) ? data.englishDescription : data.chineseDescription }}
          </p>
          <figure class="mKvFig top-1/2 left-1/2 flex justify-center absolute">
            <img
              class="max-h-full"
              :src="getImg(data)"
              :alt="(/en/.test(language) ? data.englishDescription : data.chineseDescription)"
            >
          </figure>
        </a>
      </template>
      <template #slider_nav>
        <m-svg
          class="fill-xf w-full h-full"
          svg-icon="chevron"
        />
      </template>
    </m-slider>
  </div>
</template>
