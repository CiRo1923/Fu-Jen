<script>
import mTitle from './mTitle.vue';
import mBreadCrumbs from './mBreadCrumbs.vue';

export default {
  components: {
    'm-bread-crumbs': mBreadCrumbs,
    'm-title': mTitle
  },
  props: {
    style: {
      type: Object,
      default: () => {}
    },
    breadCrumbs: {
      type: Array,
      default: () => []
    }
  }
};
</script>

<template>
  <div class="mArticle mx-auto p:w-cnt t:w-4/5 m:px-12">
    <m-bread-crumbs :path="breadCrumbs" />
    <article :class="style?.article">
      <header
        class="mArticleHd flex flex-col-reverse p:mb-40 tm:mb-28"
        :class="style?.hd"
      >
        <m-title :style="{'main': style?.title}">
          <template #title>
            <slot name="article_header" />
          </template>
        </m-title>
        <div
          v-if="$slots.article_tools"
          class="mArticleTools flex border-xd0 p:mb-76 p:border-b-6 t:mb-28 t:border-b-4 m:mb-5 m:border-b-2"
          :class="style?.tools"
        >
          <slot name="article_tools" />
        </div>
      </header>
      <div
        class="mArticleBd p:text-20 t:text-18 m:text-16"
        :class="style?.bd"
      >
        <slot name="article_content" />
      </div>
    </article>
  </div>
</template>
