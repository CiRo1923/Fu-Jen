<script>
import '../../assets/css/_tinySlider.css';
import { tns } from 'tiny-slider/src/tiny-slider.js';

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
      tinySilder: null
    };
  },
  computed: {
    slideOptions() {
      const vm = this;

      return {
        ...{
          container: `[name="${vm.name}_tinySilder"]`,
          items: 1,
          loop: !!vm.options.autoplay,
          autoplayButtonOutput: false,
          nav: false,
          controls: true,
          navPosition: 'bottom',
          prevButton: vm.options.controls !== false ? `.${vm.name}_slider_prev` : null,
          nextButton: vm.options.controls !== false ? `.${vm.name}_slider_next` : null
        },
        ...vm.options
      };
    }
  },
  watch: {
    'options.startIndex'(val) {
      const vm = this;

      vm.$nextTick(() => {
        vm.tinySilder.goTo(val);
      });
    }
  },
  // created() {
  //   const vm = this;

  //   window.addEventListener('resize', vm.init, false);
  // },
  mounted() {
    const vm = this;

    if (vm.items.length !== 0) {
      vm.init();
    }
  },
  beforeDestroy() {
    const vm = this;

    window.removeEventListener('resize', vm.init, false);
  },
  methods: {
    init() {
      const vm = this;
      const className = 'slider(tiny)';
      const init = () => {
        if (!vm.tinySilder) {
          document.querySelector(vm.slideOptions.container).classList.add(className);
          vm.tinySilder = tns(vm.slideOptions);
          vm.ready();
          vm.change();
          vm.changeEnd();
          // vm.dotAddClass();
        }
      };

      if (vm.items.length !== 0) {
        // if (vm.slideOptions?.destroy) {
        //   const equal = !/^!/.test(vm.slideOptions.destroy);
        //   const destroy = equal ? vm.slideOptions.destroy : /\w$/.exec(vm.slideOptions.destroy)[0];
        //   // const isDestroy = (equal ? (destroy === device()) : (destroy !== device()));

        //   if (isDestroy) {
        //     if (vm.tinySilder?.destroy) {
        //       vm.tinySilder.destroy();
        //       vm.tinySilder = null;
        //       document.querySelector(vm.slideOptions.container).classList.remove(className);
        //     }
        //   } else {
        //     init();
        //   }
        // } else {
        //   init();
        // }
        init();
      }
    },
    ready() {
      const vm = this;
      vm.$emit('ready', vm.tinySilder);
    },
    change() {
      const vm = this;

      vm.tinySilder.events.on('transitionStart', info => {
        vm.$emit('change', info);
      });
    },
    changeEnd() {
      const vm = this;

      vm.tinySilder.events.on('transitionEnd', info => {
        vm.$emit('change-end', info);
      });
    }
  }
};
</script>

<template>
  <div class="mSlider h-full">
    <div
      class="mSliderCnt"
      :name="`${name}_tinySilder`"
    >
      <div
        v-for="(data, i) in items"
        :key="`${name}_${i}_${items.length}`"
        class="mSliderItem"
      >
        <slot
          name="slider_content"
          :data="data"
          :index="i"
        />
      </div>
    </div>
    <div
      v-if="slideOptions.controls"
      class="mSliderNav"
    >
      <button
        type="button"
        class="mSliderArr slider_prev flex items-center justify-center"
        :class="`${name}_mSliderArr ${name}_slider_prev`"
        aria-label="Prev"
      >
        <slot name="slider_nav" />
      </button>
      <button
        type="button"
        class="mSliderArr slider_next flex items-center justify-center"
        :class="`${name}_mSliderArr ${name}_slider_next`"
        aria-label="Next"
      >
        <slot name="slider_nav" />
      </button>
    </div>
  </div>
</template>
