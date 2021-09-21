<script>
import Svg from './Svg.vue';
import mSlider from './_modules/mSlider.vue';
import { apiArticles } from '../scripts/_axios.js';
import {
  language, path, actionURL, getFunctionCadeData, getYoutubeImage, dateReturn, device, importantName
} from '../scripts/_factory.js';

export default {
  components: {
    'm-slider': mSlider,
    'm-svg': Svg
  },
  data() {
    return {
      language: language(),
      actionURL: actionURL,
      getYoutubeImage: getYoutubeImage,
      dateReturn: dateReturn,
      listPath: path('listPath'),
      articlePath: path('articlePath'),
      importantName: importantName,
      news: [],
      latestNews: [],
      campusFocus: [],
      links: [],
      report: [],
      reportName: null,
      video: null,
      honorRoll: []
    };
  },
  created() {
    const vm = this;
    let newsData = [];
    let latestNewsData = [];
    let campusFocusData = [];
    let linksData = [];
    let reportData = [];
    let honorRollData = [];
    const forEachData = (arrayName, items, page) => {
      for (let i = 0, d = 0; i < (items.length / page); i += 1) {
        arrayName.push([]);

        for (let j = 0; j < page; j += 1, d += 1) {
          if (d < items.length) {
            arrayName[i].push(items[d]);
          }
        }
      }
    };
    const apiData = (saveArray, arrayName, page, params, callback) => {
      // let saveData = saveDatas;

      if (saveArray.length !== 0) {
        forEachData(arrayName, saveArray, page);
      } else {
        apiArticles(params).then(res => {
          const { status, data } = res;

          if (status === 200) {
            const datas = data.data;
            const items = datas.items;
            console.log(data);

            // saveData = datas;

            // if (page === 2) {
            //   for (let i = 0; i < 10; i += 1) {
            //     items.push(items[0]);
            //   }
            // }

            for (let i = 0; i < items.length; i += 1) {
              saveArray.push(items[i]);
            }

            forEachData(arrayName, saveArray, page);

            if (callback) {
              callback(datas);
            }
          }
        });
      }
    };

    const apiAsync = async () => {
      // 取得 快訊
      vm.news = [];
      apiData(newsData, vm.news, 2, {
        CategoryId: 22,
        FunctionCode: 'LatestNews'
      });

      // 取得 最新動態
      vm.latestNews = [];
      apiData(latestNewsData, vm.latestNews, (device() === 'P' ? 5 : 3), {
        FunctionCode: 'LatestNews',
        ExcludeCategoryString: 22,
        Size: 15
      });

      // 取得 校園焦點
      vm.campusFocus = [];
      apiData(campusFocusData, vm.campusFocus, 3, {
        FunctionCode: 'CampusFocus',
        ExcludeCategoryString: 10,
        Size: 9
      });

      // 取得 重要連結與公告
      vm.links = [];
      apiData(linksData, vm.links, 6, {
        CategoryId: 4,
        FunctionCode: 'Link',
        Size: 24
      });

      // 取得 專題報導
      vm.report = [];
      apiData(reportData, vm.report, 1, {
        CategoryId: 10,
        FunctionCode: 'CampusFocus',
        IsWithContent: 1,
        Size: 1
      }, (data) => {
        vm.reportName = /en/.test(vm.language) ? data.items[0].categoryEnglishName : data.items[0].categoryName;
      });

      // 取得 影音專區
      if (!vm.video) {
        await apiArticles({
          FunctionCode: 'Audiovisual',
          Size: 4
        }).then(res => {
          const { status, data } = res;

          if (status === 200) {
            const items = data.data.items;
            console.log(data);

            vm.video = items;
          }
        });
      }

      // 取得 榮譽榜
      vm.honorRoll = [];
      apiData(honorRollData, vm.honorRoll, 4, {
        FunctionCode: 'HonorRoll',
        IsWithContent: 1,
        Size: 12
      });
    };

    apiAsync();

    window.addEventListener('resize', apiAsync, false);
  },
  methods: {
    getFunCode(key) {
      const vm = this;
      const funCode = getFunctionCadeData(key);

      return /en/.test(vm.language) ? funCode.englishName : funCode.chineseName;
    },
    getLinksURL(item) {
      const vm = this;
      let linksURL = null;

      if (item.type === 1) {
        linksURL = /en/.test(vm.language) ? item.englishPicturePath : item.chinesePicturePath;
      } else if (item.type === 2) {
        linksURL = /en/.test(vm.language) ? item.englishVideoURL : item.chineseVideoURL;
      }

      return linksURL;
    },
    getHonorRollImg(item) {
      const vm = this;
      let src = 'https://img.ltn.com.tw/Upload/sports/page/800/2021/04/20/phpoVHhNe.jpg';

      if (process.env.APP_ENV !== 'dev') {
        src = /en/.test(vm.language) ? item.englishPicturePath : item.chinesePicturePath;
      }

      return src;
    },
    getCampusFocusImg(item) {
      const vm = this;
      let src = 'https://www.fju.edu.tw/showImg/focus/focus1750.jpg';

      if (process.env.APP_ENV !== 'dev') {
        src = /en/.test(vm.language) ? item.englishPicturePath : item.chinesePicturePath;
      }

      return src;
    },
    returnHtmlToDescription(item) {
      const vm = this;
      let description = /en/.test(vm.language) ? item.englishContent : item.chineseContent;

      description = description.replace(/<[^>]+>/g, '');

      return description;
    }
  }
};
</script>

<template>
  <div class="home">
    <div class="news overflow-hidden relative p:py-36 t:py-28 m:py-20">
      <div class="mx-auto p:w-cnt t:w-4/6">
        <m-slider
          :key="`news_tinySilder_${news.length}`"
          name="news"
          :items="news"
          :options="{items: 1}"
          class="relative p:px-80 tm:px-40"
        >
          <template #slider_content="{ data }">
            <ul class="space-y-10">
              <li
                v-for="item, i in data"
                :key="`${item.chineseName}_${i}`"
                class="flex items-center"
              >
                <b
                  class="text-xb139 block flex-shrink-0 p:mr-40 p:text-26 t:mr-24 t:text-20 m:mr-8 m:text-16"
                >{{ /en/.test(language) ? item.categoryEnglishName : item.categoryName }}</b>
                <a
                  :href="actionURL(articlePath, ['LatestNews', item.categoryId, item.articleId])"
                  :title="(/en/.test(language) ? item.englishName : item.chineseName)"
                  class="p:text-22 t:text-18 m:text-14 block flex-grow truncate"
                >{{ /en/.test(language) ? item.englishName : item.chineseName }}</a>
              </li>
            </ul>
          </template>
          <template #slider_nav>
            <m-svg
              class="fill-xd0"
              svg-icon="chevron"
            />
          </template>
        </m-slider>
      </div>
    </div>
    <div class="latestNews pt:flex">
      <div class="pt:w-1/2">
        <div class="flex">
          <section class="section w-1/2 bg-xb139 box-border flex flex-col relative p:p-20 tm:p-8">
            <header class="sectionHd flex-shrink-0 p:mb-16 tm:mb-5">
              <h2 class="text-xf">
                <strong class="p:text-26 tm:text-15">{{ getFunCode('LatestNews') }}</strong>
              </h2>
            </header>
            <div class="sectionB flex-grow">
              <m-slider
                :key="`latestNews_tinySilder_${latestNews.length}`"
                name="latestNews"
                :items="latestNews"
                :options="{items: 1, nav: true, controls: false}"
              >
                <template #slider_content="{ data }">
                  <ul class="p:space-y-4">
                    <li
                      v-for="item, i in data"
                      :key="`${item.chineseName}_${i}`"
                    >
                      <small class="text-xf block opacity-35 p:text-22 tm:text-12">
                        {{ /en/.test(language) ? item.categoryEnglishName : item.categoryName }}
                      </small>
                      <a
                        :href="actionURL(articlePath, ['LatestNews', item.categoryId, item.articleId])"
                        class="text-xf block truncate p:text-22 tm:text-12"
                        :title="(/en/.test(language) ? item.englishName : item.chineseName)"
                      >
                        {{ /en/.test(language) ? item.englishName : item.chineseName }}
                      </a>
                    </li>
                  </ul>
                </template>
              </m-slider>
            </div>
            <footer class="sectionFt right-0 bottom-0 absolute p:mb-16 p:mr-20 tm:mb-8 tm:mr-12">
              <a
                :href="actionURL(listPath, ['LatestNews'])"
                class="text-xf border-1 border-xf rounded-8 inline-block p:px-12 p:py-3 p:text-15 tm:px-4 tm:py-1 tm:text-12"
              >
                <b>more</b>
              </a>
            </footer>
          </section>
          <figure class="w-1/2">
            <img
              src="~home/latest_news.jpg"
              :alt="getFunCode('LatestNews')"
            >
          </figure>
        </div>
        <div class="flex flex-row-reverse">
          <section class="section w-1/2 bg-x1479 box-border flex flex-col relative p:p-20 tm:p-8">
            <header class="sectionHd flex-shrink-0 p:mb-16 tm:mb-5">
              <h2 class="text-xf">
                <strong class="p:text-26 tm:text-15">{{ getFunCode('CampusFocus') }}</strong>
              </h2>
            </header>
            <div class="sectionBd flex-grow">
              <m-slider
                :key="`campusFocus_tinySilder_${campusFocus.length}`"
                name="campusFocus"
                :items="campusFocus"
                :options="{items: 1, nav: true, controls: false}"
              >
                <template #slider_content="{ data }">
                  <ul class="p:space-y-4 tm:space-y-2">
                    <li
                      v-for="item, i in data"
                      :key="`${item.chineseName}_${i}`"
                      class="flex flex-row-reverse"
                    >
                      <div class="campusFocusData p:pl-20 tm:pl-8">
                        <small class="text-xf block opacity-35 p:text-22 tm:text-12">
                          {{ /en/.test(language) ? item.categoryEnglishName : item.categoryName }}
                        </small>
                        <a
                          :href="actionURL(articlePath, ['CampusFocus', item.categoryId, item.articleId])"
                          :title="(/en/.test(language) ? item.englishName : item.chineseName)"
                          class="text-xf block p:text-22 tm:text-12"
                        >
                          {{ /en/.test(language) ? item.englishName : item.chineseName }}
                        </a>
                      </div>
                      <div class="campusFocusPhotoFrame">
                        <figure class="campusFocusFig w-full h-full overflow-hidden relative">
                          <img
                            class="top-1/2 left-1/2 relative"
                            :src="getCampusFocusImg(item)"
                            alt=""
                          >
                        </figure>
                      </div>
                    </li>
                  </ul>
                </template>
              </m-slider>
            </div>
            <footer class="sectionFt right-0 bottom-0 absolute p:mb-16 p:mr-20 tm:mb-8 tm:mr-12">
              <a
                :href="actionURL(listPath, ['CampusFocus'])"
                class="text-xf border-1 border-xf rounded-8 inline-block p:px-12 p:py-3 p:text-15 tm:px-4 tm:py-1 tm:text-12"
              >
                <b>more</b>
              </a>
            </footer>
          </section>
          <figure class="w-1/2">
            <img
              src="~home/campus_focus.jpg"
              :alt="getFunCode('CampusFocus')"
            >
          </figure>
        </div>
      </div>
      <div class="pt:w-1/2">
        <div class="flex">
          <section class="section w-1/2 bg-xb139 box-border flex flex-col relative p:p-20 tm:p-8">
            <header class="sectionHd flex-shrink-0 p:mb-16 m:mb-5">
              <h2 class="text-xf">
                <strong class="p:text-26 tm:text-15">{{ /en/.test(language) ? importantName.englishName : importantName.chineseName }}</strong>
              </h2>
            </header>
            <div class="sectionBd flex-grow">
              <m-slider
                :key="`links_tinySilder_${links.length}`"
                name="links"
                :items="links"
                :options="{items: 1, nav: true, controls: false}"
              >
                <template #slider_content="{ data }">
                  <ul class="p:space-y-14 tm:space-y-5">
                    <li
                      v-for="item, i in data"
                      :key="`${item.chineseName}_${i}`"
                    >
                      <a
                        :href="getLinksURL(item)"
                        class="text-xf block truncate p:text-22 tm:text-12"
                        :title="(/en/.test(language) ? item.englishName : item.chineseName)"
                      >
                        {{ /en/.test(language) ? item.englishName : item.chineseName }}
                      </a>
                    </li>
                  </ul>
                </template>
              </m-slider>
            </div>
          </section>
          <figure class="w-1/2">
            <picture>
              <source
                srcset="/assets/img/home/links.webp"
                type="image/webp"
              >
              <img
                src="~home/links.jpg"
                :alt="(/en/.test(language) ? importantName.englishName : importantName.chineseName)"
              >
            </picture>
          </figure>
        </div>
        <div class="flex flex-row-reverse">
          <section class="section w-1/2 bg-x1479 box-border flex flex-col relative p:p-20 tm:p-8">
            <header class="sectionHd flex-shrink-0 p:mb-16 tm:mb-5">
              <h2 class="text-xf">
                <strong class="p:text-26 tm:text-15">{{ reportName }}</strong>
              </h2>
            </header>
            <div class="sectionBd flex-grow">
              <m-slider
                :key="`report_tinySilder_${report.length}`"
                name="report"
                :items="report"
                :options="{items: 1, nav: true, controls: false}"
              >
                <template #slider_content="{ data }">
                  <ul class="p:space-y-5">
                    <li
                      v-for="item, i in data"
                      :key="`${item.chineseName}_${i}`"
                    >
                      <!-- eslint-disable vue/no-v-html -->
                      <div
                        class="text-xf p:text-22 tm:text-12"
                        v-html="(/en/.test(language) ? item.englishContent : item.chineseContent )"
                      />
                      <!--eslint-enable-->
                    </li>
                  </ul>
                </template>
              </m-slider>
            </div>
          </section>
          <figure class="w-1/2">
            <picture>
              <source
                srcset="/assets/img/home/report.webp"
                type="image/webp"
              >
              <img
                src="~home/report.jpg"
                :alt="getFunCode('CampusFocus')"
              >
            </picture>
          </figure>
        </div>
      </div>
    </div>
    <div class="audio text-center overflow-hidden relative">
      <div class="top-0 left-0 w-full h-full flex flex-col items-center justify-center absolute">
        <div class="p:-mt-40 t:-mt-48">
          <p
            class="text-xf
            p:mb-24 p:text-38
            t:mb-20 t:text-26
            m:mb-16"
          >
            <b>為追求真、善、美、聖<br>全人教育之師生共同體</b>
          </p>
          <div>
            <a
              :href="actionURL(listPath, ['Audiovisual'])"
              class="text-xf border-1 border-xf inline-block
              p:px-16 p:py-5 p:text-24
              pt:rounded-12
              t:px-10 t:py-3 t:text-16
              m:px-4 m:py-1 m:text-12 m:rounded-8"
            >
              <b>more</b>
            </a>
          </div>
        </div>
        <div class="bottom-0 absolute m:hidden">
          <ul class="flex items-center">
            <li
              v-for="item, index in video"
              :key="`${item.chineseName}_${index}`"
              class="audioItem
              p:mx-14
              t:mx-10"
            >
              <a
                :href="(/en/.test(language) ? item.englishVideoURL : item.chineseVideoURL)"
                :title="(/en/.test(language) ? item.englishName : item.chineseName)"
                class="block"
                target="_blank"
                rel="noopener"
              >
                <figure class="audioFig relative">
                  <img
                    :src="getYoutubeImage(item)"
                    :alt="(/en/.test(language) ? item.englishName : item.chineseName)"
                  >
                </figure>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <figure>
        <picture>
          <source
            srcset="/assets/img/home/video_background.webp"
            type="image/webp"
          >
          <img
            src="~home/video_background.jpg"
            alt="為追求真、善、美、聖 全人教育之師生共同體"
          >
        </picture>
      </figure>
    </div>
    <div
      class="honorRoll text-center bg-xe2 relative
      p:py-40
      t:py-28
      m:py-20"
    >
      <div
        class="honorRollBd mx-auto text-left relative
        p:w-4/6
        t:w-5/6
        m:w-3/5"
      >
        <m-slider
          :key="`honorRoll_tinySilder_${honorRoll.length}`"
          name="honorRoll"
          :items="honorRoll"
          :options="{items: 1, nav: true, controls: false}"
        >
          <template #slider_content="{ data }">
            <ul
              class="
                p:-my-32
                pt:flex pt:flex-wrap
                t:-my-16
                m:space-y-20"
            >
              <li
                v-for="item, i in data"
                :key="`${item.chineseName}_${i}`"
                class="honorRollItem
                  pt:w-1/2 pt:flex pt:flex-col"
              >
                <section
                  class="bg-xf box-border
                  p:m-32
                  pt:flex-grow
                  t:m-16"
                >
                  <a
                    :href="actionURL(articlePath, ['HonorRoll', item.categoryId, item.articleId])"
                    :title="(/en/.test(language) ? item.englishName : item.chineseName)"
                    class="block w-full h-full box-border
                      p:p-32
                      t:p-16
                      m:p-12"
                  >
                    <div
                      class="flex items-center flex-row-reverse
                        p:mb-44
                        t:mb-16
                        m:mb-5"
                    >
                      <header
                        class="honorRollItemTitle box-border
                          p:pl-16
                          t:pl-8
                          m:pl-5"
                      >
                        <h2
                          class="text-x1479 truncate
                            p:text-24
                            t:text-18
                            m:text-15"
                        >
                          <strong>{{ /en/.test(language) ? item.englishName : item.chineseName }}</strong>
                        </h2>
                        <time
                          class="block text-x7e
                            p:text-18
                            t:text-15
                            m:text-12"
                        >
                          <b>{{ dateReturn(item.startTime) }}</b>
                        </time>
                      </header>
                      <div class="honorRollPhotoFrame relative">
                        <figure class="honorRollFig top-1/2 left-1/2 overflow-hidden relative">
                          <img
                            class="left-1/2 relative"
                            :src="getHonorRollImg(item)"
                            :alt="(/en/.test(language) ? item.englishName : item.chineseName)"
                          >
                        </figure>
                      </div>
                    </div>
                    <div
                      class="honorRollData
                        p:text-18
                        t:text-16
                        m:text-12"
                    >
                      <b>{{ returnHtmlToDescription(item) }}</b>
                    </div>
                  </a>
                </section>
              </li>
            </ul>
          </template>
        </m-slider>
        <div class="right-0 bottom-0 p:-mb-10 p:mr-32 absolute">
          <a
            :href="actionURL(listPath, ['HonorRoll'])"
            class="text-x1479 border-1 border-x1479 inline-block
              p:px-16 p:py-5 p:text-24
              pt:rounded-12
              t:px-10 t:py-3 t:text-16
              m:px-4 m:py-1 m:text-12 m:rounded-8"
          >
            <b>more</b>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
