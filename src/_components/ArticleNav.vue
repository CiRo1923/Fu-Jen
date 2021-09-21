<script>
import {
  actionURL
} from '../scripts/_factory.js';
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
  },
  data() {
    return {
      actionURL: actionURL
    };
  }
};
</script>

<template>
  <m-article
    :style="{'title': '--badge'}"
    :bread-crumbs="[data.data.menuPage.menuPageName, data.data.page.pageName]"
  >
    <template #article_header>
      {{ data.data.page.pageName }}
    </template>
    <template #article_content>
      <!-- eslint-disable vue/no-v-html -->
      <div
        v-if="data.data.isActive === 1"
        class="p:text-20 t:text-18 m:text-16"
        v-html="data.data.page.pageContent"
      />
      <!--eslint-enable-->
      <div v-else>
        <a
          v-if="data.data.isActive === 2"
          class="p:text-20 t:text-18 m:text-16"
          :href="data.data.url"
          :title="data.data.url"
          target="_blank"
          rel="noopener"
        >{{ data.data.url }}</a>
        <a
          v-else
          class="p:text-20 t:text-18 m:text-16"
          :href="data.data.filePath"
          :title="data.data.filePath"
          target="_blank"
          rel="noopener"
        >{{ data.data.filePath }}</a>
      </div>
    </template>
  </m-article>
</template>
