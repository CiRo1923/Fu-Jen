<script>
import { apiCategories, apiArticles } from '../scripts/_axios.js';
import {
  language, params, path, actionURL, getFunctionCadeData, dateReturn
} from '../scripts/_factory.js';
import mArticle from './_modules/mArticle.vue';

export default {
  components: {
    'm-article': mArticle
  },
  data() {
    return {
      language: language(),
      funCode: getFunctionCadeData(),
      actionURL: actionURL,
      dateReturn: dateReturn,
      params: params,
      listPath: path('listPath'),
      article: null,
      typeName: {}
    };
  },
  created() {
    const vm = this;
    const catId = Number(vm.params('categoryId'));
    const articleId = Number(vm.params('articleId'));

    const apiAsync = async () => {
      await apiCategories().then(res => {
        const { status, data } = res;

        if (status === 200) {
          const items = data.data.items;

          for (let i = 0; i < items.length; i += 1) {
            const {
              categoryId, chineseName, englishName
            } = items[i];

            if (categoryId === catId) {
              vm.typeName.chineseName = chineseName;
              vm.typeName.englishName = englishName;
            }
          }
        }
      });

      await apiArticles({
        params: {
          articleId: articleId
        }
      }).then(res => {
        const { status, data } = res;

        console.log(data);

        if (status === 200) {
          vm.article = data.data;
        }
      });
    };

    apiAsync();
  },
  methods: {
    getTitle(article) {
      const vm = this;

      return /en/.test(vm.language) ? article?.englishName : article?.chineseName;
    }
  }
};
</script>

<template>
  <m-article
    :bread-crumbs="[`${getTitle(funCode)}-${actionURL(listPath, [funCode.id, ])}`,
                    `${getTitle(typeName)}-${actionURL(listPath, [funCode.id, params('categoryId')])}`,
                    getTitle(article)]"
  >
    <template #article_header>
      {{ getTitle(article) }}
    </template>
    <template #article_tools>
      <span class="flex items-center flex-grow">
        <time class="p:text-20 t:text-16 m:text-14 block">{{ dateReturn(article?.startTime) }}</time>
        <small class="p:ml-10 p:text-20 t:ml-8 t:text-16 m:text-14 block">
          {{ /en/.test(language) ? typeName.englishName : typeName.chineseName }}
        </small>
      </span>
      <div class="flex-shrink-0">
        <a
          :href="actionURL(listPath, [funCode.id])"
          title="返回列表"
        >
          <em class="p:text-20 t:text-16 m:text-14 not-italic">&lt; 返回列表</em>
        </a>
      </div>
    </template>
    <template #article_content>
      <!-- eslint-disable vue/no-v-html -->
      <div v-html="(/en/.test(language) ? article?.englishContent : article?.chineseContent)" />
      <!--eslint-enable-->
    </template>
  </m-article>
</template>
