<script>
import '../assets/css/index.css';

export default {
  setup() {
    const text = 'Hello!!';

    return {
      text
    };
  }
};
</script>

<template>
  <div>
    Home
    {{ text }}
  </div>
</template>

<style></style>
