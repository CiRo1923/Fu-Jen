<script>
// import { Swiper } from 'swiper/vue';
import Swiper from 'swiper';
import SwiperCore, {
  Pagination, Mousewheel, Autoplay, Navigation, EffectFade, EffectCube, EffectCoverflow, EffectFlip, EffectCards, EffectCreative, Zoom, FreeMode
} from 'swiper';
SwiperCore.use([
  Pagination,
  Mousewheel,
  Autoplay,
  Navigation,
  EffectFade,
  EffectCube,
  EffectCoverflow,
  EffectFlip,
  EffectCards,
  EffectCreative,
  Zoom,
  FreeMode]);
import 'swiper/css';
import 'swiper/css/effect-fade';
import 'swiper/css/effect-cards';
import 'swiper/css/effect-cube';
import 'swiper/css/effect-flip';
import 'swiper/css/effect-coverflow';
import 'swiper/css/effect-creative';
import 'swiper/css/free-mode';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

export default {
  props: {
    name: {
      type: String,
      default: ''
    },
    options: {
      type: Object,
      default: () => {}
    },
    items: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      swiper: null
    };
  },
  computed: {
    slideOptions() {
      const vm = this;

      return {
        ...{
          pagination: {
            el: `.${vm.name}Pagination`,
            clickable: true
          },
          navigation: {
            prevEl: '.swiper-button-prev',
            nextEl: '.swiper-button-next'
          }
        },
        ...vm.options
      };
    }
  },
  mounted() {
    const vm = this;

    vm.swiper = new Swiper(vm.$refs.swiper, vm.slideOptions);
  }
};
</script>

<template>
  <div
    ref="swiper"
    class="mSlider swiper-container h-full"
  >
    <div
      class="mSliderCnt swiper-wrapper"
      :name="`${name}_swiper`"
    >
      <div
        v-for="(data, i) in items"
        :key="`${name}_${i}_${items.length}`"
        class="mSliderItem swiper-slide"
        :class="`${name}Item`"
      >
        <slot
          name="slider_content"
          :data="data"
          :index="i"
        />
      </div>
    </div>
    <div
      v-show="slideOptions.nav"
      class="mSliderNav"
    >
      <button
        type="button"
        class="mSliderArr swiper-button-prev flex items-center justify-center"
        :class="`${name}Arr ${name}Prev`"
        aria-label="Prev"
      >
        <slot name="slider_nav" />
      </button>
      <button
        type="button"
        class="mSliderArr swiper-button-next flex items-center justify-center"
        :class="`${name}Arr ${name}Next`"
        aria-label="Next"
      >
        <slot name="slider_nav" />
      </button>
    </div>
  </div>
</template>
