<script>
import { apiCategories, apiArticles } from '../scripts/_axios.js';
import {
  language, params, path, actionURL, getFunctionCadeData, dateReturn, getImageSrc
} from '../scripts/_factory.js';
import mLoading from './_modules/mLoading.vue';
import mArticle from './_modules/mArticle.vue';

export default {
  components: {
    'm-loading': mLoading,
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
      isLoadding: true,
      article: null,
      typeName: {}
    };
  },
  created() {
    const vm = this;
    const catId = Number(vm.params('categoryId'));
    const articleId = Number(vm.params('articleId'));

    console.log(catId);
    console.log(articleId);

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

    apiAsync().then(() => {
      vm.isLoadding = false;
    });
  },
  methods: {
    getTitle(article) {
      const vm = this;

      return /en/.test(vm.language) ? article?.englishName : article?.chineseName;
    },
    getVideo(article) {
      const vm = this;
      let videoURL = null;

      if (article?.type === 2) {
        if (/en/.test(vm.language)) {
          videoURL = article?.englishVideoURL || null;
        } else {
          videoURL = article?.chineseVideoURL || null;
        }
      }

      return videoURL
        ? videoURL.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i)[1]
        : videoURL;
    },
    getSrc(item) {
      const vm = this;
      let src = null;

      if (/en/.test(vm.language.toLowerCase()) && item.englishPicturePath) {
        src = getImageSrc(item.englishPicturePath);
      } else if (/tw/.test(vm.language.toLowerCase()) && item.chinesePicturePath) {
        src = getImageSrc(item.chinesePicturePath);
      }

      // console.log(item.chinesePicturePath);

      return src;
    }
  }
};
</script>

<template>
  <m-article
    :bread-crumbs="[`${getTitle(funCode)}|||${actionURL(listPath, [funCode.id, '0', '1'])}`,
                    `${getTitle(typeName)}|||${actionURL(listPath, [funCode.id, params('categoryId'), '1'])}`]"
  >
    <template
      v-if="!isLoadding"
      #article_header
    >
      {{ getTitle(article) }}
    </template>
    <template
      v-if="!isLoadding"
      #article_tools
    >
      <span class="flex items-center flex-grow">
        <time class="p:text-20 t:text-16 m:text-14 block">{{ dateReturn(article?.startTime) }}</time>
        <small class="p:ml-10 p:text-20 t:ml-8 t:text-16 m:text-14 block">
          {{ /en/.test(language) ? typeName.englishName : typeName.chineseName }}
        </small>
      </span>
      <div class="flex-shrink-0">
        <a
          :href="actionURL(listPath, [funCode.id, '0', '1'])"
          title="返回列表"
        >
          <em class="p:text-20 t:text-16 m:text-14 not-italic">&lt; 返回列表</em>
        </a>
      </div>
    </template>
    <template
      v-if="!isLoadding"
      #article_content
    >
      <div>
        <figure
          v-if="article?.type === 1 && (/en/.test(language) ? article?.englishPicturePath : article?.chinesePicturePath)"
          class="p:mb-40 tm:mb-28"
        >
          <img
            :src="getSrc(article)"
            :alt="(/en/.test(language) ? typeName.englishName : typeName.chineseName)"
          >
        </figure>
        <!-- eslint-disable vue/no-v-html -->
        <div v-html="(/en/.test(language) ? article?.englishContent : article?.chineseContent)" />
        <!--eslint-enable-->
      </div>
      <div
        v-if="getVideo(article)"
        class="video p:mt-20 t:mt-16 m:mt-12"
      >
        <iframe
          width="100%"
          height="100%"
          :src="`https://www.youtube.com/embed/${getVideo(article)}`"
          :title="getTitle(article)"
          frameborder="0"
          allow="accelerometer;  clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />
      </div>
    </template>
    <template #article_loading>
      <m-loading :loadend="!isLoadding" />
    </template>
  </m-article>
</template>
