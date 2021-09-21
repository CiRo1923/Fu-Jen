<script>
export default {
  props: {
    svgIcon: {
      type: String,
      default: ''
    }
  }
};
</script>

<template>
  <svg class="block">
    <use :xlink:href="`#${svgIcon}`" />
  </svg>
</template>
