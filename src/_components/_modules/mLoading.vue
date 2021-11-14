<script>
export default {
  props: {
    loadend: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isLoading: true
    };
  },
  watch: {
    loadend() {
      const vm = this;

      if (vm.loadend) {
        setTimeout(() => {
          vm.isLoading = false;
        }, 1500);
      }
    }
  }
};
</script>

<template>
  <div
    v-if="isLoading"
    class="mLoading top-0 left-0 w-full h-full fixed z-10"
    :class="{'--hide': loadend}"
  >
    <div class="mLoadingBd w-full h-full flex items-center justify-center">
      <figure class="mLoadingFig relative">
        <img
          src="~common/logo.svg"
          alt="loading"
        >
      </figure>
    </div>
  </div>
</template>
