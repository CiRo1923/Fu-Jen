<script>
import { apiMenu } from './scripts/_axios.js';
import { reactive, watch } from 'vue';
import { useRoute } from 'vue-router';

export default {
  setup() {
    const route = useRoute();
    const menu = reactive({
      data: []
    });
    const getTarget = (type) => {
      return type === '_self' ? null : type;
    };

    watch(() => route.params, () => {
      (async () => {
      // 取得 選單
        apiMenu({
          UserRoleId: null,
          UserRoleRouteName: null
        }).then(res => {
          const { data } = res;
          if (data.code === 200) {
            const items = data.data.items;

            console.log(items);

            menu.data = [];

            for (let i = 0; i < items.length; i += 1) {
              const {
                chineseName, englishName, chineseURL, englishURL, chineseURLActionType, englishURLActionType, children
              } = items[i];

              menu.data.push({
                name: route.params.language === 'enUS' ? englishName : chineseName,
                URL: (route.params.language === 'enUS' ? englishURL : chineseURL) || 'javascript:;',
                target: route.params.language === 'enUS'
                  ? getTarget(englishURLActionType)
                  : getTarget(chineseURLActionType)
              });
            }
          }
        });
      })();
    });

    return {
      route,
      menu
    };
  },
  data() {
    return {
      url: 'home'
    };
  }
};
</script>

<template>
  <div class="lWrap">
    <div class="lHd flex">
      <header class="mHd">
        Header {{ route.params.language }}
      </header>
      <div class="mNav">
        <nav class="mNavMain">
          <ul>
            <li
              v-for="items in menu.data"
              :key="items.name"
            >
              <router-link
                :to="items.URL"
                :target="items.target"
              >
                {{ items.name }}
              </router-link>
            </li>
            <li>
              <router-link
                v-if="route.params.language === 'enUS'"
                :to="{ name: 'about', params: { language: 'enUS', articleId: 1 } }"
              >
                about1
              </router-link>
              <router-link
                v-else
                :to="{ name: 'about', params: { language: 'zhTW', articleId: 1 } }"
              >
                about1
              </router-link>
            </li>
          </ul>
        </nav>
        <div>
          <router-link :to="{ name: url, params: { language: 'enUS' } }">
            EN
          </router-link>
        </div>
      </div>
    </div>
    <router-view />
  </div>
</template>
