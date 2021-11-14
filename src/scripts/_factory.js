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

  if (window.innerWidth <= 740 || /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    return 'M';
  }

  if ((angle === 0 && window.innerWidth > 740 && window.innerWidth < 1024) || /Android|webOS|iPad|BlackBerry/i.test(navigator.userAgent)) {
    return 'T';
  }

  if ((angle !== 0 && window.innerWidth > 730 && window.innerWidth < 815) || /iPhone/i.test(navigator.userAgent)) {
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
  const listRegex = new RegExp(`${document.querySelector('[name="listPath"]').value}\\w+\\/(\\d+)`);

  if (key === 'listPath' && listRegex.test(window.location.pathname)) {
    const id = listRegex.exec(window.location.pathname)[1];
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

          if (/en\w+\/?$/.test(window.location.pathname)) {
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
          console.log(query);
        } else if (paramName === 'page') {
          // console.log(query);
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
  const cover = youtubeURL ? youtubeURL.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i)[1] : null;
  let coverPath = cover ? `https://img.youtube.com/vi/${cover}/mqdefault.jpg` : null;

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

  // console.log(src);

  return imgPath;
};

export let j$ = null;
export let eventQueue = [];

if (typeof j$ === 'undefined') {
  window.j$ = {};
}

document.addEventListener('DOMContentLoaded', () => {
  eventQueue.forEach(fn => {
    fn();
  });
}, { passive: true });

j$ = arg => {
  var htmlEls;
  var matches;

  if (arg instanceof Function) {
    eventQueue.push(arg);
    return document;
  } if (arg instanceof Object) {
    return new j$.Fn([arg]);
  }
  if (arg instanceof HTMLElement) {
    htmlEls = [arg];
  } else {
    matches = arg ? arg.match(/^<(\w+)>$/) : null;

    if (matches) {
      htmlEls = [document.createElement(matches[1])];
    } else {
      htmlEls = Array.prototype.slice.call(document.querySelectorAll(arg));
    }
  }

  return new j$.Fn(htmlEls);
};

// eslint-disable-next-line func-names
j$.Fn = function (elements) {
  this[0] = elements;
  return this;
};

j$.Fn.prototype = {
  // eslint-disable-next-line func-names
  html: function (string) {
    if (typeof string !== 'undefined') {
      this[0].forEach(el => {
        el.innerHTML = string;
      });

      return this;
    }
    return this[0][0].innerHTML;
  },
  // eslint-disable-next-line func-names
  text: function (string) {
    let text = '';

    if (typeof string !== 'undefined') {
      this[0].forEach(el => {
        el.innerText = string;
      });

      return this;
    }

    this[0].forEach(el => {
      text += el.innerText;
    });

    return text;
  },
  // eslint-disable-next-line func-names
  parents: function (className) {
    let target = this[0][0];
    let $parents = null;

    while (target.parentNode != null && target.parentNode !== document.documentElement) {
      if (target.matches) {
        if (target.matches(className)) {
          $parents = new j$.Fn([target]);
          break;
        }
      } else if (target.msMatchesSelector) {
        if (target.msMatchesSelector(className)) {
          $parents = new j$.Fn([target]);
          break;
        }
      }
      target = target.parentNode;
    }
    return $parents;
  },
  // eslint-disable-next-line func-names
  parent: function () {
    var parents = [];
    var currentParent = null;

    this[0].forEach(el => {
      currentParent = el.parentElement;

      if (parents.indexOf(currentParent) === -1) {
        parents.push(currentParent);
      }
    });

    return new j$.Fn(parents);
  },
  // eslint-disable-next-line func-names
  prev: function () {
    let prev = null;

    this[0].forEach(el => {
      prev = el.previousElementSibling;
    });

    return new j$.Fn([prev]);
  },
  // eslint-disable-next-line func-names
  next: function () {
    let next = null;

    this[0].forEach(el => {
      next = el.nextElementSibling;
    });

    return new j$.Fn([next]);
  },
  // eslint-disable-next-line func-names
  find: function (selector) {
    let matchingElements = [];
    let currentMatchesQuery = null;
    let currentMatches = null;

    this[0].forEach(el => {
      const className = el.className ? `.${el.className.replace(/(?!\s)(\W)/g, '\\$1').replace(/\s/g, '.')}` : null;

      currentMatchesQuery = /^\s?>/.test(selector)
        ? document.querySelectorAll(`${className} ${selector.replace(/^\s/, '')}`)
        : el.querySelectorAll(selector);
      currentMatches = Array.prototype.slice.call(currentMatchesQuery);
      currentMatches.forEach(match => {
        if (matchingElements.indexOf(match) === -1) {
          matchingElements.push(match);
        }
      });
    });

    return new j$.Fn(matchingElements);
  },
  // eslint-disable-next-line func-names
  children: function (tagName) {
    let children = [];

    this[0].forEach(el => {
      for (let i = 0; i < el.children.length; i += 1) {
        const $children = el.children[i];

        if (tagName) {
          if ((/^./.test(tagName) && $children.className === tagName) || (/^#/.test(tagName) && $children.id === tagName)) {
            children.push($children);
          } else if ($children.nodeName.toLowerCase() === tagName) {
            children.push($children);
          }
        } else {
          children.push($children);
        }
      }
    });

    return new j$.Fn(children);
  },
  // eslint-disable-next-line func-names
  siblings: function () {
    let sibling = this[0][0].parentNode.firstChild;
    let siblings = [];

    while (sibling) {
      if (sibling.nodeType === 1 && sibling !== this[0][0]) {
        siblings.push(sibling);
      }

      sibling = sibling.nextSibling;
    }

    return new j$.Fn(siblings);
  },
  // eslint-disable-next-line func-names
  closest: function (selector) {
    if (!Element.prototype.matches) {
      Element.prototype.matches = Element.prototype.msMatchesSelector
      || Element.prototype.webkitMatchesSelector;
    }

    if (!Element.prototype.closest) {
      // eslint-disable-next-line func-names
      Element.prototype.closest = function (s) {
        var el = this;
        if (!document.documentElement.contains(el)) return null;
        do {
          if (el.matches(s)) return el;
          el = el.parentElement;
        } while (el !== null);
        return null;
      };
    }

    let closest = null;
    this[0].forEach(el => {
      closest = el.closest(selector);
    });

    return new j$.Fn([closest]);
  },
  // eslint-disable-next-line func-names
  click: function () {
    this[0].forEach(el => {
      el.click();
    });

    return this;
  },
  // eslint-disable-next-line func-names
  trigger: function (eventName) {
    this[0].forEach(el => {
      let event = document.createEvent('Event');
      event.initEvent(eventName, true, true);
      el.dispatchEvent(event);
    });

    return this;
  },
  // eslint-disable-next-line func-names
  hover: function (mouseoverhandle, mouseouthandle) {
    this[0].forEach(el => {
      el.addEventListener('mouseenter', mouseoverhandle, { passive: false });
      el.addEventListener('mouseleave', mouseouthandle || mouseoverhandle, { passive: false });
    });

    return this;
  },
  // eslint-disable-next-line func-names
  on: function (eventName, elementSelector, handle) {
    this[0].forEach(el => {
      if (elementSelector && typeof elementSelector === 'string') {
        if (eventName === 'ready') {
          el.addEventListener('DOMContentLoaded', e => {
            handle.call(e);
          }, { passive: false });
        } else {
          el.addEventListener(eventName, e => {
            for (let target = e.target; target && target !== this; target = target.parentNode) {
              if (target.matches) {
                if (target.matches(elementSelector)) {
                  e.$this = target;
                  handle.call(target, e);
                  break;
                }
              } else if (target.msMatchesSelector) {
                if (target.msMatchesSelector(elementSelector)) {
                  e.$this = target;
                  handle.call(target, e);
                  break;
                }
              }
            }
          }, { passive: false });
        }
      } else {
        const func = elementSelector;

        if (eventName === 'ready') {
          el.addEventListener('DOMContentLoaded', e => {
            func.call(e);
          }, { passive: false });
        } else {
          el.addEventListener(eventName, e => {
            e.$this = el;
            func.call(e.target, e);
          }, { passive: false });
        }
      }
    });

    return this;
  },
  // eslint-disable-next-line func-names
  off: function (eventName, elementSelector, handle) {
    // eslint-disable-next-line func-names
    this[0].forEach(function (el) {
      if (elementSelector && typeof elementSelector === 'string') {
        // eslint-disable-next-line func-names
        el.removeEventListener(eventName, function (e) {
          for (let target = e.target; target && target !== this; target = target.parentNode) {
            if (target.matches) {
              if (target.matches(elementSelector)) {
                e.$this = target;
                handle.call(target, e);
                break;
              }
            } else if (target.msMatchesSelector) {
              if (target.msMatchesSelector(elementSelector)) {
                e.$this = target;
                handle.call(target, e);
                break;
              }
            }
          }
        }, { passive: false });
      } else {
        const func = elementSelector || null;
        el.removeEventListener(eventName, e => {
          e.$this = el;
          func.call(e.target, e);
        }, { passive: false });
      }
    });

    return this;
  },
  // eslint-disable-next-line func-names
  addClass: function (className) {
    this[0].forEach(el => {
      el.classList.add(className);
    });

    return this;
  },
  // eslint-disable-next-line func-names
  removeClass: function (className) {
    this[0].forEach(el => {
      el.classList.remove(className);
    });

    return this;
  },
  // eslint-disable-next-line func-names
  toggleClass: function (className) {
    this[0].forEach(el => {
      el.classList.toggle(className);
    });

    return this;
  },
  // eslint-disable-next-line func-names
  hasClass: function (className) {
    let hasClass = false;

    this[0].forEach(el => {
      hasClass = el ? new RegExp('(\\s|^)' + className + '(\\s|$)').test(el.className) : false;
      // if (el.className.replace(/[\n\t]/g, ' ').indexOf(className) > -1) {
      //   hasClass = true;
      // } else {
      //   hasClass = false;
      // }
    });

    return hasClass;
  },
  // eslint-disable-next-line func-names
  attr: function (attributeName, attributeValue) {
    if (typeof attributeValue !== 'undefined') {
      this[0].forEach(el => {
        el.setAttribute(attributeName, attributeValue);
      });

      return this;
    }
    return this[0][0].getAttribute(attributeName);
  },
  // eslint-disable-next-line func-names
  data: function (attributeName, attributeValue) {
    if (typeof attributeValue !== 'undefined') {
      this[0].forEach(el => {
        el.dataset[attributeName] = attributeValue;
      });

      return this;
    }
    return this[0][0].dataset[attributeName];
  },
  // eslint-disable-next-line func-names
  removeAttr: function (attributeName) {
    this[0].forEach(el => {
      el.removeAttribute(attributeName);
    });

    return this;
  },
  // eslint-disable-next-line func-names
  width: function () {
    let width = '';

    this[0].forEach(el => {
      width = el.innerWidth || el.offsetWidth || el.scrollWidth || el.clientWidth;
    });

    return width;
  },
  // eslint-disable-next-line func-names
  height: function () {
    let height = '';

    this[0].forEach(el => {
      height = el.innerHeight || el.offsetHeight || el.scrollHeight || el.clientHeight;
    });

    return height;
  },
  // eslint-disable-next-line func-names
  css: function (style, value) {
    if (typeof style !== 'undefined' && typeof value !== 'undefined') {
      this[0].forEach(el => {
        el.style[style] = value;
      });

      return this;
    }
    return getComputedStyle(this[0][0])[style];
  },
  // eslint-disable-next-line func-names
  empty: function () {
    while (this[0][0].firstChild) {
      this[0][0].removeChild(this[0][0].firstChild);
    }

    return this;
  },
  // eslint-disable-next-line func-names
  remove: function () {
    this[0].forEach((el) => {
      if (!('remove' in Element.prototype)) {
        el.parentNode.removeChild(el);
      } else {
        el.remove();
      }
    });
  },
  // eslint-disable-next-line func-names
  append: function (arg) {
    if (arg instanceof j$.Fn) {
      // eslint-disable-next-line func-names
      arg[0].forEach(function (el) {
        const elem = el.length ? el.cloneNode(true) : el;
        this[0][0].appendChild(elem);
      }.bind(this));
    } else if (arg instanceof HTMLElement) {
      const child = arg.length ? arg.cloneNode(true) : arg;
      this[0][0].appendChild(child);
    } else if (typeof arg === 'string') {
      this[0].forEach(el => {
        el.innerHTML += arg;
      });
    }

    return this;
  },
  // eslint-disable-next-line func-names
  before: function (arg) {
    if (arg instanceof j$.Fn) {
      // eslint-disable-next-line func-names
      arg[0].forEach(function (el) {
        this[0][0].parentNode.insertBefore(el, this[0][0]);
      }.bind(this));
    }

    return this;
  },
  // eslint-disable-next-line func-names
  after: function (arg) {
    if (arg instanceof j$.Fn) {
      // eslint-disable-next-line func-names
      arg[0].forEach(function (el) {
        if (this[0][0].parentNode.lastChild === this[0][0]) {
          this[0][0].parentNode.appendChild(el, this[0][0]);
        } else {
          this[0][0].parentNode.insertBefore(el, this[0][0].nextSibling);
        }
      }.bind(this));
    }

    return this;
  },
  // eslint-disable-next-line func-names
  val: function (value) {
    if (typeof value !== 'undefined') {
      this[0].forEach(el => {
        el.value = value;
      });

      return this;
    }
    return this[0][0].value;
  },
  // eslint-disable-next-line func-names
  offset: function () {
    const wScroll = {
      y: /(iPhone||iPad)\W+.*\sOS\s12_/.test(navigator.userAgent) ? window.scrollY : 0
    };
    let $el = this[0][0];
    let top = 0;
    let left = 0;

    while ($el && typeof ($el.offsetLeft) !== 'undefined' && typeof ($el.offsetTop) !== 'undefined') {
      top += $el.offsetTop - $el.scrollTop + $el.clientTop;
      left += $el.offsetLeft - $el.scrollLeft + $el.clientLeft;

      $el = $el.offsetParent;
    }

    return { top: (top + wScroll.y), left: left };
  },
  // eslint-disable-next-line func-names
  position: function () {
    let $el = this[0][0];
    let top = 0;
    let left = 0;
    let parentTop = $el.offsetParent.offsetTop;
    let parentLeft = $el.offsetParent.offsetLeft;

    while ($el) {
      top += $el.offsetTop - $el.scrollTop + $el.clientTop;
      left += $el.offsetLeft - $el.scrollLeft + $el.clientLeft;

      $el = $el.offsetParent;
    }

    return { top: (top - parentTop), left: (left - parentLeft) };
  },
  // eslint-disable-next-line func-names
  prop: function (type, value) {
    let prop = null;

    if (typeof value !== 'undefined') {
      this[0].forEach(el => {
        el[type] = value;
      });

      return this;
    }

    this[0].forEach(el => {
      prop = el[type];
    });

    return prop;
  },
  // eslint-disable-next-line func-names
  eq: function (index) {
    return new j$.Fn([typeof this[0][0][0] !== 'undefined' ? this[0][0][0][index] : this[0][index]]);
  },
  // eslint-disable-next-line func-names
  index: function () {
    const children = this[0][0].parentNode.children;

    let num = 0;
    for (let i = 0; i < children.length; i += 1) {
      if (children[i] === this[0][0]) {
        return num;
      }
      if (children[i].nodeType === 1) {
        num += 1;
      }
    }
    return -1;
  }
};

export const prjs = {
  $w: j$(window),
  $d: j$(document),
  $hb: j$('html, body'),
  $b: j$('body')
};

export const scrollTo = obj => {
  const top = (obj.top ? obj.top : 0);
  const left = (obj.left ? obj.left : 0);
  const supportsNativeSmoothScroll = 'scrollBehavior' in document.documentElement.style;
  const nativeSmoothScrollTo = () => {
    window.scroll({
      top: top,
      left: left,
      behavior: 'smooth'
    });
  };
  const smoothScrollTo = () => {
    const element = document.scrollingElement || document.documentElement;
    const start = element.scrollTop;
    const change = (top - start);
    const startDate = +new Date();
    const easeInOutQuad = (t, b, c, d) => {
      let T = (t / (d / 2));
      if (T < 1) return (c / 2) * T * T + b;
      T = (t - 1);
      return (-c / 2) * (t * (t - 2) - 1) + b;
    };

    const animateScroll = () => {
      const currentDate = +new Date();
      const currentTime = currentDate - startDate;
      element.scrollTop = parseInt(easeInOutQuad(currentTime, start, change, 600), 10);
      if (currentTime < 600) {
        requestAnimationFrame(animateScroll);
      } else {
        element.scrollTop = top;
      }
    };
    animateScroll();
  };

  if (supportsNativeSmoothScroll) {
    nativeSmoothScrollTo();
  } else {
    smoothScrollTo();
  }
};
