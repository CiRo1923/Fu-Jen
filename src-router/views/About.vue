<script>
export default {
  computed: {
    language() {
      return this.$route.params.language;
    },
    articleId() {
      return this.$route.params.articleId;
    }
  }
};
</script>

<template>
  <div>
    About {{ language }} {{ articleId }}
  </div>
</template>

<style>

</style>
