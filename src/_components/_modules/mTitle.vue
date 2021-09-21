<script>
export default {
  props: {
    style: {
      type: Object,
      default: () => {}
    }
  }
};
</script>

<template>
  <h2
    class="mTitle text-x1479 p:text-32 t:text-28 m:text-26"
    :class="style.main"
  >
    <strong>
      <slot name="title" />
    </strong>
  </h2>
</template>
