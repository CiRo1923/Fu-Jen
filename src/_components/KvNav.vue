<script>

export default {
  props: {
    datas: {
      type: [Object, Array],
      default: () => {}
    }
  },
  computed: {
    bannerImg() {
      const vm = this;
      let src = '/static/img/banner.jpg';

      if (process.env.APP_ENV !== 'dev') {
        src = vm.datas.data.menuPage.menuPageBannerPath;
      }

      return src;
    }
  }
};
</script>

<template>
  <div class="mKv h-full overflow-hidden relative">
    <p
      v-if="datas.data.menuPage.menuPageBannerText"
      class="mKvTitle p:text-44 t:text-28 m:text-20 text-xf absolute"
    >
      {{ datas.data.menuPage.menuPageBannerText }}
    </p>
    <figure class="mKvFig top-1/2 left-1/2 flex justify-center absolute">
      <img
        class="max-h-full"
        :src="bannerImg"
        :alt="datas.data.menuPage.menuPageBannerText"
      >
    </figure>
  </div>
</template>
