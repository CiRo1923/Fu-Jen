<script>
import { apiArticles } from '../scripts/_axios.js';
import {
  language, params, getFunctionCadeData, path, actionURL, dateReturn, getYoutubeImage, listAllName, getImageSrc
} from '../scripts/_factory.js';
import mTitle from './_modules/mTitle.vue';
import mBreadCrumbs from './_modules/mBreadCrumbs.vue';
import mPagination from './_modules/mPagination.vue';

export default {
  components: {
    'm-bread-crumbs': mBreadCrumbs,
    'm-pagination': mPagination,
    'm-title': mTitle
  },
  inject: {
    data: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      language: language(),
      funCode: getFunctionCadeData(),
      actionURL: actionURL,
      dateReturn: dateReturn,
      getYoutubeImage: getYoutubeImage,
      params: params,
      listPath: path('listPath'),
      imgPath: path('apiPath'),
      articlePath: path('articlePath'),
      list: null,
      listCategoryName: {
        englishName: listAllName.englishName,
        chineseName: listAllName.chineseName
      },
      page: [],
      nowPage: params('listPage'),
      totalPage: 0
    };
  },
  created() {
    const vm = this;
    const dataItems = vm.data.data.items;

    console.log(vm.data);

    for (let i = 0; i < dataItems.length; i += 1) {
      const { categoryId, chineseName, englishName } = dataItems[i];

      if (categoryId === Number(params('listPath'))) {
        vm.listCategoryName.chineseName = chineseName;
        vm.listCategoryName.englishName = englishName;
      }
    }

    const apiAsync = async () => {
      await apiArticles({
        CategoryId: params('listPath'),
        FunctionCode: vm.funCode.id,
        Page: vm.nowPage,
        Size: 10
      }).then(res => {
        const { status, data } = res;
        const noePage = Number(vm.nowPage);
        const maxItem = Number(document.querySelector('#list').dataset.maxItem);
        const pageItem = Number(document.querySelector('#list').dataset.pageItem);
        const pagePush = (index) => {
          vm.page.push({
            number: (index + 1),
            url: actionURL(vm.listPath, [`functionCode-${vm.funCode.id}`, `listCategory-${params('listPath') || 0}`, `page-${(index + 1)}`])
          });
        };

        if (status === 200) {
          const { items, totalSize } = data.data;

          console.log(data);

          vm.totalPage = Math.ceil(totalSize / maxItem);

          if (vm.totalPage <= pageItem) {
            for (let i = 0; i < vm.totalPage; i += 1) {
              pagePush(i);
            }
          } else if ((noePage + pageItem) >= vm.totalPage) {
            for (let i = (vm.totalPage - pageItem); i < vm.totalPage; i += 1) {
              pagePush(i);
            }
          } else {
            for (let i = (noePage - 1); i < (noePage + (pageItem - 1)); i += 1) {
              pagePush(i);
            }
          }

          console.log(vm.totalPage);
          console.log(vm.page);
          console.log(Number(vm.nowPage));

          vm.list = items;
        }
      });
    };

    apiAsync();
  },
  methods: {
    getSrc(item) {
      const vm = this;
      let src = null;

      if (/en/.test(vm.language) && item.englishPicturePath) {
        src = getImageSrc(item.englishPicturePath);
      } else if (/tw/.test(vm.language) && item.chinesePicturePath) {
        src = getImageSrc(item.chinesePicturePath);
      }

      return src;
    }
  }
};
</script>

<template>
  <div class="mx-auto p:w-cnt t:w-4/5 m:mt-24 m:px-12">
    <m-bread-crumbs
      :path="[(/en/.test(language) ? funCode.englishName : funCode.chineseName),
              (/en/.test(language) ? listCategoryName.englishName : listCategoryName.chineseName)]"
    />
    <div class="mList">
      <header class="mListHd p:mb-32 t:mb-24 m:mb-16">
        <m-title :style="{'main': '--badge'}">
          <template #title>
            {{ /en/.test(language) ? listCategoryName.englishName : listCategoryName.chineseName }}
          </template>
        </m-title>
      </header>
      <ul class="mListBd p:space-y-80 t:space-y-48 m:space-y-24">
        <li
          v-for="item in list"
          :key="item.chineseName"
        >
          <div class="mListItem flex flex-row-reverse">
            <section class="mListItemSec flex-grow">
              <header class="mListItemSecHd p:mb-16 m:mb-5 flex flex-col-reverse">
                <h2>
                  <a
                    :href="actionURL(articlePath, [funCode.id, item.categoryId, item.articleId])"
                    :title="(/en/.test(language) ? item.englishName : item.chineseName)"
                    class="mListItemTitle block m:overflow-hidden"
                  >
                    <strong class="text-x057d p:text-24 t:text-18 m:text-15">{{ /en/.test(language) ? item.englishName : item.chineseName }}</strong>
                  </a>
                </h2>
                <span class="p:mb-28 m:mb-5 flex p:border-b-6 m:border-b-2 border-xd0">
                  <time class="p:text-20 t:text-16 m:text-14 block">{{ dateReturn(item.startTime) }}</time>
                  <small class="p:text-20 t:text-16 m:text-14 block p:ml-10 m:ml-5">{{ item.categoryName }}</small>
                </span>
              </header>
              <div class="mListItemSecBd">
                <p class="p:text-20 t:text-14 m:text-12">
                  {{ /en/.test(language) ? item.englishContent : item.chineseContent }}
                </p>
              </div>
            </section>
            <div
              class="mListItemFigFrame p:mr-28 t:mr-16 m:mr-8 flex-shrink-0 overflow-hidden relative"
              :class="{'--video': item.type !== 1}"
            >
              <a
                :href="actionURL(articlePath, [funCode.id, item.categoryId, item.articleId])"
                :title="(/en/.test(language) ? item.englishName : item.chineseName)"
                class="block w-full h-full"
                tabindex="-1"
              >
                <figure class="mListItemFig top-0 left-1/2 h-full absolute">
                  <img
                    v-if="item.type === 1 && getSrc(item)"
                    :src="getSrc(item)"
                    :alt="(/en/.test(language) ? item.englishContent : item.chineseContent)"
                  >
                  <img
                    v-else-if="item.type === 2 && getYoutubeImage(item)"
                    :src="getYoutubeImage(item)"
                    :alt="(/en/.test(language) ? item.englishContent : item.chineseContent)"
                  >
                  <img
                    v-else
                    src="~list/no_picture.svg"
                    alt="no picture"
                  >
                </figure>
              </a>
            </div>
          </div>
        </li>
      </ul>
      <footer class="mListFt text-center">
        <m-pagination
          :first-url="actionURL(listPath, [`functionCode-${funCode?.id}`, `listCategory-${params('listPath') || 0}`, 'page-1'])"
          :last-url="actionURL(listPath, [`functionCode-${funCode?.id}`, `listCategory-${params('listPath') || 0}`, `page-${totalPage}`])"
          :now-page="nowPage"
          :pages="page"
          class="p:mt-80 t:mt-48 m:mt-24"
        />
      </footer>
    </div>
  </div>
</template>
