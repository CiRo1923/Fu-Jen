<script>
import Svg from './Svg.vue';
import mLoading from './_modules/mLoading.vue';
import mSlider from './_modules/mSlider.vue';
import { apiArticles, apiLinks, apiPositionSetting } from '../scripts/_axios.js';
import {
  prjs, j$, language, path, actionURL, getFunctionCadeData, getYoutubeImage, dateReturn, device, importantName, getImageSrc
} from '../scripts/_factory.js';

export default {
  components: {
    'm-loading': mLoading,
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
      isLoadding: true,
      importantName: importantName,
      positionSetting: false,
      news: [],
      square: false,
      latestNews: [],
      campusFocus: [],
      links: [],
      report: [],
      reportName: null,
      reportMore: null,
      video: null,
      honorRoll: [],
      u2bId: 'AseiHxeWixQ',
      u2bSet: {
        rel: 0,
        version: 3,
        cc_load_policy: 1,
        autoplay: 1,
        mute: 1,
        showinfo: 0,
        controls: 0,
        autohide: 1,
        loop: 1,
        vq: 'hd720'
      }
    };
  },
  computed: {
    u2bOptions() {
      const vm = this;
      let options = null;

      Object.keys(vm.u2bSet).forEach((item) => {
        if (!options) {
          options = `${item}=${vm.u2bSet[item]}`;
        } else {
          options += `&${item}=${vm.u2bSet[item]}`;
        }
      });

      return options;
    }
  },
  created() {
    const vm = this;
    let newsData = [];
    let latestNewsData = [];
    let campusFocusData = [];
    let linksData = [];
    let reportData = [];
    let honorRollData = [];
    let apiLen = 0;
    let itemLen = 0;
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
    const apiData = (api, saveArray, arrayName, page, params, callback) => {
      // let saveData = saveDatas;

      if (saveArray.length !== 0) {
        forEachData(arrayName, saveArray, page);
      } else {
        api(params).then(res => {
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
        }).then(() => {
          apiLen += 1;

          if (itemLen === apiLen) {
            vm.isLoadding = false;
          }
        });
      }
    };

    const apiAsync = async () => {
      // 取得所有網站版位設定
      if (!vm.positionSetting) {
        vm.positionSetting = true;

        await apiPositionSetting().then(res => {
          const { status, data } = res;

          console.log(data);

          if (status === 200) {
            const { items } = data.data;

            itemLen = items.length;

            for (let i = 0; i < items.length; i += 1) {
              const { isActive, websiteSectionPositionSettingId } = items[i];

              if (websiteSectionPositionSettingId === 1) {
              // 取得 快訊
                vm.news = [];
                if (isActive === 1) {
                  apiData(apiArticles, newsData, vm.news, 4, {
                    CategoryId: 22,
                    FunctionCode: 'LatestNews',
                    isChineseActive: /en/.test(vm.language.toLowerCase()) ? '' : 1,
                    isEnglishActive: /en/.test(vm.language.toLowerCase()) ? 1 : ''
                  });
                }
              }

              if (websiteSectionPositionSettingId === 2) {
              // 取得 最新動態
                vm.latestNews = [];
                // 取得 重要連結與公告
                vm.links = [];
                // 取得 校園焦點
                vm.campusFocus = [];
                // 取得 專題報導
                vm.report = [];

                if (isActive === 1) {
                  vm.square = true;

                  console.log(device());

                  // 取得 最新動態
                  apiData(apiArticles, latestNewsData, vm.latestNews, (device() === 'P' ? 3 : 2), {
                    FunctionCode: 'LatestNews',
                    ExcludeCategoryString: '快訊',
                    Size: (device() === 'P' ? 15 : 10),
                    isChineseActive: /en/.test(vm.language.toLowerCase()) ? '' : 1,
                    isEnglishActive: /en/.test(vm.language.toLowerCase()) ? 1 : ''
                  });

                  // 取得 重要連結與公告
                  apiData(apiLinks, linksData, vm.links, (device() === 'P' ? 8 : 5), {
                    CategoryId: 4,
                    TopCount: (device() === 'P' ? 24 : 15),
                    isChineseActive: /en/.test(vm.language.toLowerCase()) ? '' : 1,
                    isEnglishActive: /en/.test(vm.language.toLowerCase()) ? 1 : ''
                  });

                  // 取得 校園焦點
                  apiData(apiArticles, campusFocusData, vm.campusFocus, 3, {
                    FunctionCode: 'CampusFocus',
                    ExcludeCategoryString: '專輯報導',
                    Size: 9,
                    isChineseActive: /en/.test(vm.language.toLowerCase()) ? '' : 1,
                    isEnglishActive: /en/.test(vm.language.toLowerCase()) ? 1 : ''
                  });

                  // 取得 專題報導
                  apiData(apiArticles, reportData, vm.report, 1, {
                    CategoryId: 10,
                    FunctionCode: 'CampusFocus',
                    IsWithContent: 1,
                    Size: 1,
                    isChineseActive: /en/.test(vm.language.toLowerCase()) ? '' : 1,
                    isEnglishActive: /en/.test(vm.language.toLowerCase()) ? 1 : ''
                  }, (reportRes) => {
                    const { items: reportItems } = reportRes;
                    if (reportItems.length !== 0) {
                      vm.reportName = /en/.test(vm.language) ? items[0].categoryEnglishName : items[0].categoryName;
                      vm.reportMore = actionURL(vm.articlePath, ['CampusFocus', (items[0].categoryId + ''), (items[0].articleId + '')]);
                    }
                  });
                }
              }

              if (websiteSectionPositionSettingId === 3) {
                if (isActive === 1) {
                // 取得 影音專區
                  if (!vm.video) {
                    apiArticles({
                      FunctionCode: 'Audiovisual',
                      Size: 4,
                      isChineseActive: /en/.test(vm.language.toLowerCase()) ? '' : 1,
                      isEnglishActive: /en/.test(vm.language.toLowerCase()) ? 1 : ''
                    }).then(videoRes => {
                      const { status: videoStatus, data: videoData } = videoRes;

                      if (videoStatus === 200) {
                        const { items: videoItems } = videoData.data;
                        console.log(videoData);

                        vm.video = videoItems;

                        for (let j = 0; j < vm.video.length; j += 1) {
                          const { categoryId, articleId } = vm.video[j];

                          vm.video[j].linksURL = actionURL(vm.articlePath, ['Audiovisual', (categoryId + ''), (articleId + '')]);
                        }
                      }
                    });
                  }
                }
              }

              if (websiteSectionPositionSettingId === 4) {
              // 取得 榮譽榜
                vm.honorRoll = [];

                if (isActive === 1) {
                  apiData(apiArticles, honorRollData, vm.honorRoll, 4, {
                    FunctionCode: 'HonorRoll',
                    IsWithContent: 1,
                    Size: 12,
                    isChineseActive: /en/.test(vm.language.toLowerCase()) ? '' : 1,
                    isEnglishActive: /en/.test(vm.language.toLowerCase()) ? 1 : ''
                  });
                }
              }
            }
          }
        });
      }
    };

    apiAsync().then(() => {
      setTimeout(() => {
        vm.scrollFun();
      }, 1000);
    });

    window.addEventListener('resize', apiAsync, false);
    window.addEventListener('scroll', vm.scrollFun, false);
  },
  methods: {
    scrollFun() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const height = prjs.$w.height();
      const calcH = ((height / 3) * 2);
      const $area = j$('.jIdxArea');

      for (let i = 0; i < $area[0].length; i += 1) {
        const $item = $area.eq(i);
        const offsetTop = $item.offset().top;
        const itemHeight = $item.height();

        if (scrollTop > (offsetTop - calcH) && (scrollTop < (offsetTop + itemHeight) || scrollTop + height === prjs.$d.height())) {
          $item.addClass('--anim');
        } else {
          $item.removeClass('--anim');
        }
      }
    },
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
      } else if (!item.type) {
        linksURL = /en/.test(vm.language) ? item.englishURL : item.chineseURL;
      }

      return linksURL;
    },
    getTarget(url) {
      return /^https?:\/\//.test(url) ? '_blank' : null;
    },
    getRel(url) {
      return /^https?:\/\//.test(url) ? 'noopener' : null;
    },
    returnHtmlToDescription(item) {
      const vm = this;
      let description = /en/.test(vm.language) ? item.englishContent : item.chineseContent;

      description = description ? description.replace(/<[^>]+>/g, '') : null;

      return description;
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
  <div class="home">
    <div
      v-if="!isLoadding && news.length !== 0"
      class="news overflow-hidden relative p:py-36 t:py-28 m:py-20"
    >
      <div class="mx-auto p:w-cnt t:w-4/6">
        <m-slider
          :key="`news_tinySilder_${news.length}`"
          name="news"
          :items="news"
          :options="{items: 1}"
          class="relative p:px-80 tm:px-40"
        >
          <template #slider_content="{ data }">
            <ul class="pt:-m-10 pt:flex pt:flex-wrap">
              <li
                v-for="item, i in data"
                :key="`${item.chineseName}_${i}`"
                class="pt:p-10 pt:w-1/2 flex items-center"
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
    <div
      v-if="!isLoadding && square"
      class="latestNews pt:flex"
    >
      <div class="pt:w-1/2">
        <div class="flex jIdxArea">
          <section class="section w-1/2 bg-xb139 box-border flex flex-col relative p:p-20 tm:p-8">
            <header class="sectionHd flex-shrink-0 p:mb-16 tm:mb-5">
              <h2 class="text-xf">
                <strong class="p:text-26 tm:text-15">{{ getFunCode('LatestNews') }}</strong>
              </h2>
            </header>
            <div class="sectionBd flex-grow">
              <m-slider
                :key="`latestNews_tinySilder_${latestNews.length}`"
                name="latestNews"
                :items="latestNews"
                :options="{items: 1, nav: true, controls: false}"
              >
                <template #slider_content="{ data }">
                  <ul class="p:space-y-10">
                    <li
                      v-for="item, i in data"
                      :key="`${item.chineseName}_${i}`"
                    >
                      <time class="text-xf block opacity-35 p:text-22 tm:text-12">
                        {{ dateReturn(item.startTime) }}
                      </time>
                      <a
                        :href="actionURL(articlePath, ['LatestNews', item.categoryId, item.articleId])"
                        class="latestNewsLinks text-xf block p:text-22 tm:text-12"
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
                :href="actionURL(listPath, ['LatestNews', '0', '1'])"
                class="text-xf border-1 border-xf rounded-8 inline-block p:px-12 p:py-3 p:text-15 tm:px-4 tm:py-1 tm:text-12"
              >
                <b>more</b>
              </a>
            </footer>
          </section>
          <figure class="w-1/2 overflow-hidden">
            <img
              class="latestNewsFig"
              src="~home/latest_news.jpg"
              :alt="getFunCode('LatestNews')"
            >
          </figure>
        </div>
        <div class="flex flex-row-reverse jIdxArea">
          <section class="section w-1/2 bg-x1479 box-border flex flex-col relative p:p-20 tm:p-8">
            <header class="sectionHd flex-shrink-0 p:mb-16 tm:mb-5">
              <h2 class="text-xf">
                <strong class="p:text-26 tm:text-15">{{ getFunCode('CampusFocus') }}</strong>
              </h2>
            </header>
            <div
              v-if="campusFocus.length !== 0"
              class="sectionBdd flex-grow"
            >
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
                      <div class="campusFocusPhotoFrame p:px-1">
                        <figure class="campusFocusFig w-full h-full overflow-hidden relative">
                          <img
                            class="top-1/2 left-1/2 relative"
                            :src="getSrc(item)"
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
                :href="actionURL(listPath, ['CampusFocus', '0', '1'])"
                class="text-xf border-1 border-xf rounded-8 inline-block p:px-12 p:py-3 p:text-15 tm:px-4 tm:py-1 tm:text-12"
              >
                <b>more</b>
              </a>
            </footer>
          </section>
          <figure class="w-1/2 overflow-hidden">
            <img
              class="latestNewsFig"
              src="~home/campus_focus.jpg"
              :alt="getFunCode('CampusFocus')"
            >
          </figure>
        </div>
      </div>
      <div class="pt:w-1/2">
        <div class="flex jIdxArea">
          <section class="section w-1/2 bg-xb139 box-border flex flex-col relative p:p-20 tm:p-8">
            <header class="sectionHd flex-shrink-0 p:mb-16 m:mb-5">
              <h2 class="text-xf">
                <strong class="p:text-26 tm:text-15">{{ /en/.test(language) ? importantName.englishName : importantName.chineseName }}</strong>
              </h2>
            </header>
            <div
              v-if="links.length !== 0"
              class="sectionBdd flex-grow"
            >
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
                        :target="getTarget(getLinksURL(item))"
                        :rel="getRel(getLinksURL(item))"
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
          <figure class="w-1/2 overflow-hidden">
            <img
              class="latestNewsFig --delay-1"
              src="~home/links.jpg"
              :alt="(/en/.test(language) ? importantName.englishName : importantName.chineseName)"
            >
          </figure>
        </div>
        <div class="flex flex-row-reverse jIdxArea">
          <section class="section w-1/2 bg-x1479 box-border flex flex-col relative p:p-20 tm:p-8">
            <header class="sectionHd flex-shrink-0 p:mb-16 tm:mb-5">
              <h2 class="text-xf">
                <strong class="p:text-26 tm:text-15">{{ reportName }}</strong>
              </h2>
            </header>
            <div
              v-if="report.length !== 0"
              class="sectionBdd flex-grow"
            >
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
            <footer
              v-if="reportMore"
              class="sectionFt right-0 bottom-0 absolute p:mb-16 p:mr-20 tm:mb-8 tm:mr-12"
            >
              <a
                :href="reportMore"
                class="text-xf border-1 border-xf rounded-8 inline-block p:px-12 p:py-3 p:text-15 tm:px-4 tm:py-1 tm:text-12"
              >
                <b>more</b>
              </a>
            </footer>
          </section>
          <figure class="w-1/2 overflow-hidden">
            <img
              class="latestNewsFig --delay-1"
              src="~home/report.jpg"
              :alt="getFunCode('CampusFocus')"
            >
          </figure>
        </div>
      </div>
    </div>
    <div
      v-if="!isLoadding && video"
      class="audio text-center overflow-hidden relative jIdxArea"
    >
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
              :href="actionURL(listPath, ['Audiovisual', '0', '1'])"
              class="text-xf border-1 border-xf inline-block
              p:px-16 p:py-5 p:text-24
              pt:rounded-12
              t:px-10 t:py-3 t:text-16
              m:px-4 m:py-1 m:text-12 m:rounded-8"
              title="MORE VIDEO"
            >
              <b>MORE VIDEO</b>
            </a>
          </div>
        </div>
        <div class="bottom-0 mb-20 absolute m:hidden">
          <ul class="flex items-center">
            <li
              v-for="item, index in video"
              :key="`${item.chineseName}_${index}`"
              class="audioItem
              p:mx-14
              t:mx-10"
            >
              <a
                :href="item.linksURL"
                :title="(/en/.test(language) ? item.englishName : item.chineseName)"
                class="block"
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
      <div class="audioU2B overflow-hidden relative tm:hidden">
        <iframe
          width="100%"
          height="100%"
          class="top-1/2 left-1/2 absolute"
          :src="`https://www.youtube.com/embed/${u2bId}?${u2bOptions}&playlist=${u2bId}`"
          title="YouTube video player"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />
      </div>
      <figure class="overflow-hidden p:hidden">
        <img
          class="audioBgFig relative"
          src="~home/video_background.jpg"
          alt="為追求真、善、美、聖 全人教育之師生共同體"
        >
      </figure>
    </div>
    <div
      v-if="!isLoadding && honorRoll.length !== 0"
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
                  pt:w-1/2 pt:flex pt:flex-col p:py-8"
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
                    class="honorRollLink block w-full h-full box-border
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
                            :src="getSrc(item)"
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
            :href="actionURL(listPath, ['HonorRoll', '0', '1'])"
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
    <m-loading :loadend="!isLoadding" />
  </div>
</template>
