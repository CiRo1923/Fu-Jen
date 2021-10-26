export const rootPath = '/University';
export const userRoute = new RegExp(`(?!${rootPath})\\/(\\w+)\\/(.*TW|.*tw|en)`).test(window.location.pathname)
  ? new RegExp(`(?!${rootPath})\\/(\\w+)\\/(.*TW|.*tw|en)`).exec(window.location.pathname)[1]
  : 'Web';

export const functionCode = JSON.parse(document.querySelector('[name="functionCode"]').value.replace(/'/g, '"'));
export const listAllName = JSON.parse(document.querySelector('[name="listName"]').value.replace(/'/g, '"'));
export const importantName = JSON.parse(document.querySelector('[name="importantName"]').value.replace(/'/g, '"'));

export const svgRequire = (req) => {
  const use = Array.prototype.slice.call(document.getElementsByTagName('use'));
  use.forEach(elem => {
    const { href } = elem;
    const svg = `${/(?!#).*/.exec(href.baseVal)[0]}.svg`;
    let files = {};

    req.keys().forEach(filename => {
      if (new RegExp(filename).test(svg)) {
        files[filename] = req(filename);
      }
    });
  });
};

export const device = () => {
  let angle = window.screen.orientation ? window.screen.orientation.angle : 0;

  if (window.screen.width <= 740 || /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    return 'M';
  }
  if ((angle === 0 && window.screen.width > 740 && window.screen.width < 1024) || /Android|webOS|iPad|BlackBerry/i.test(navigator.userAgent)) {
    return 'T';
  } if ((angle !== 0 && window.screen.width > 730 && window.screen.width < 815) || /iPhone/i.test(navigator.userAgent)) {
    return 'M';
  }
  return 'P';
};

export const language = (callback) => {
  const langData = document.querySelector('[name="language"]').value.split(',');
  let langResult = null;

  for (let i = 0; i < langData.length; i += 1) {
    const item = langData[i].replace(/^\s/, '');
    const lang = item.split('-')[0];
    const text = item.split('-')[1];

    if (new RegExp(lang).test(window.location.pathname)) {
      langResult = lang;
    } else if (!new RegExp(lang).test(window.location.pathname) && callback) {
      callback(item, lang, text);
    }

    if (!langResult && /tw/.test(lang.toLowerCase())) {
      langResult = lang;
    }
  }

  return langResult;
};

export const getFunctionCadeData = (key) => {
  let funCode = null;

  for (let i = 0; i < functionCode.length; i += 1) {
    const { id } = functionCode[i];
    if (key && key === id) {
      funCode = functionCode[i];
    } else if (new RegExp(id).test(window.location.pathname)) {
      funCode = functionCode[i];
    }
  }

  return funCode;
};

export const path = (name) => {
  return document.querySelector(`[name="${name}"]`).value;
};

export const params = (key) => {
  let paramsValue = null;

  if (key === 'listPath' && /List\/\w+\/(\d+)/.test(window.location.pathname)) {
    const id = /List\/\w+\/(\d+)/.exec(window.location.pathname)[1];
    paramsValue = id === '0' ? null : id;
  } else if (key === 'categoryId') {
    paramsValue = new RegExp(`${getFunctionCadeData().id}/(\\d+)`).test(window.location.pathname)
      ? new RegExp(`${getFunctionCadeData().id}/(\\d+)`).exec(window.location.pathname)[1]
      : null;
  } else if ((key === 'articleId' && /(\d+)\/?$/.test(window.location.pathname)) || key === 'listPage') {
    paramsValue = /(\d+)\/?$/.exec(window.location.pathname)[1];
  } else if (key === 'menuPage') {
    paramsValue = new RegExp(`(?!${rootPath})\\/(.*TW|.*tw|en)\\/(\\w+)`).exec(window.location.pathname)[2];
  } else if (key === 'menuPageId' || key === 'page') {
    paramsValue = /([^/]+)\/?$/.exec(window.location.pathname)[1];
  }
  // console.log(path(key));

  // if (key === 'functionCode') {
  //   for (let i = 0; i < functionCode.length; i += 1) {
  //     const { id } = functionCode[i];

  //     if (new RegExp(id).test(window.location.pathname)) {
  //       paramsValue = id;
  //     }
  //   }
  // }
  // const paramsKey = new RegExp(`${key}=([^?&#]*)`);
  return paramsValue;
};

export const queryParam = (param, value) => {
  const symbol = /\?/.test(window.location.href) ? '&' : '?';
  const paramsKey = new RegExp(`([?;&])${param}[^&;]*[;&]?`);
  let query = null;

  if (paramsKey.test(window.location.href)) {
    query = window.location.href.replace(paramsKey, `$1${param}=${value}`);
  } else {
    query = `${window.location.href}${symbol}${param}=${value}`;
  }

  return query;
};

export const dateReturn = (date) => {
  const dateValue = date ? /\d{4}\W\d{2}\W\d{2}/.exec(date)[0] : null;

  return dateValue;
};

export const actionURL = (page, param) => {
  // const symbol = /\?/.test(window.location.href) ? '&' : '?';
  let newPath = `${rootPath}/${userRoute}/${language()}/${page || ''}`;
  let query = null;

  if (page === 'index') {
    newPath = /en/.test(language()) ? `${rootPath}/${userRoute}/${language()}` : '/';
    query = newPath;
  } else {
    for (let i = 0; i < param.length; i += 1) {
      const paramName = param[i].toString().split('-')[0];
      const paramValue = param[i].toString().split('-').length === 1 ? null : param[i].toString().split('-')[1];

      // const paramsKey = new RegExp(`([?;&])${paramName}[^&;]*[;&]?`);

      if (paramValue) {
        if (paramName === 'userRoute') {
          newPath = `${rootPath}/${paramValue}/${language()}/${page || ''}`;
          query = newPath;
        } else if (paramName === 'language') {
          let lang = null;

          if (/en.*\/?$/.test(window.location.pathname)) {
            lang = '/';
          } else if (new RegExp(language()).test(window.location.pathname)) {
            lang = window.location.pathname.replace(language(), paramValue);
          } else {
            lang = `${rootPath}/${userRoute}/${paramValue}/${page || ''}`;
          }

          query = lang;
        } else if (paramName === 'functionCode') {
          // const funCode = new RegExp(paramValue).test(window.location.pathname)
          //   ? `${window.location.pathname.replace(/\/$/, '').replace(getFunctionCadeData().id, `${paramValue}/`)}`
          //   : `${query || newPath}${paramValue}/`;
          query = `${newPath}${paramValue}/`;
        } else if (paramName === 'listCategory') {
          const categoryId = /List\/(\w+)\/(\d+)\//.test(window.location.pathname)
            ? `${window.location.pathname.replace(/\/$/, '').replace(/List\/(\w+)\/(\d+)\//, `List/$1/${paramValue}/`)}`
            : `${query || newPath}${paramValue}/`;
          query = categoryId;
        } else if (paramName === 'articleCategory') {
          query = `${query}${paramValue}/`;
        } else if (paramName === 'page') {
          query = `${query.replace(/\d+$/, paramValue)}/`;
        } else {
          query = `${query || newPath}${paramName}`;
        }
      } else {
        query = `${query || newPath}${paramName}/`;
      }

      // if (i === 0) {

      // } else if (paramName) {
      //   query = `${query}/${paramName}/${paramValue}`;
      // } else {
      //   query = `${query}/${paramName}/${params(paramName)}`;
      // }
    }
  }

  return query;
};

export const getYoutubeImage = (item) => {
  const youtubeURL = /en/.test(language()) ? item.englishVideoURL : item.chineseVideoURL;
  const cover = youtubeURL.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i)[1];
  let coverPath = `https://img.youtube.com/vi/${cover}/maxresdefault.jpg`;

  return coverPath;
};

export const getImageSrc = (src) => {
  let imgPath = null;
  const apiPath = path('apiPath');

  if (src) {
    if (/^www\./.test(src)) {
      imgPath = `http://${src}`;
    } else if (/^\/uploads/.test(src.toLowerCase())) {
      imgPath = `${apiPath}${src}`;
    } else {
      imgPath = src;
    }
  }

  return imgPath;
};
