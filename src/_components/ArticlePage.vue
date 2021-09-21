<script>
import mArticle from './_modules/mArticle.vue';

export default {
  components: {
    'm-article': mArticle
  },
  inject: {
    data: {
      type: Object,
      default: () => {}
    }
  }
};
</script>

<template>
  <m-article
    :style="{'title': '--badge'}"
    :bread-crumbs="[data.data.name]"
  >
    <template #article_header>
      {{ data.data.name }}
    </template>
    <template #article_content>
      <!-- eslint-disable vue/no-v-html -->
      <div
        class="p:text-20 t:text-18 m:text-16"
        v-html="data.data.content"
      />
      <!--eslint-enable-->
    </template>
  </m-article>
</template>
