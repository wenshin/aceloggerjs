const SENTRY_CACHE_KEY = 'acelogger-sentry-fail-send-key';

interface RequestOptions {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  data: string;
}

export function request(options: RequestOptions) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (!xhr) {
      alert('Giving up :( Cannot create an XMLHTTP instance');
      return;
    }

    function onStateChange() {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status !== 200) {
          const data = getCachedData();
          data.push(options);
          localStorage.setItem(SENTRY_CACHE_KEY, JSON.stringify(data));
          reject(xhr);
        } else {
          resolve(xhr.responseText);
        }
      }
    }
    xhr.onreadystatechange = onStateChange;
    xhr.open(options.method, options.url);
    if (options.headers) {
      Object.keys(options.headers).forEach((k) => {
        xhr.setRequestHeader(k, options.headers[k]);
      });
    }
    xhr.send(options.data);
    return;
  });
}

function flushCachedData() {
  const data = getCachedData();
  if (data.length) {
    console.log('resend sentry data:', data.length);
    data.forEach((option) => {
      request(option);
    });
    localStorage.setItem(SENTRY_CACHE_KEY, '');
  }
}

function getCachedData(): RequestOptions[] {
  try {
    const json = localStorage.getItem(SENTRY_CACHE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (err) {
    console.warn(err);
    return [];
  }
}

if (typeof window === 'object') {
  window.addEventListener('load', () => {
    flushCachedData();
  });
}
