const CLIENT_ID = '[CLIENT ID HERE]';

const album_url = (id) => `https://api.imgur.com/3/album/${id}`;

function get_headers() {
  return {
    'Authorization': 'Client-ID ' + CLIENT_ID,
  }
}

const id = get_id();

if (id) {
  process(id);
}

function process(id) {
  // hide usage
  document.getElementById('usage').style.display = 'none';

  // show spinner
  document.getElementById('spinner').style.display = 'block';

  fetch(album_url(id), { headers: get_headers() })
    .then((response) => response.json())
    .then((response) => build_slideshow(response.data))
    .catch(error => console.error(error));
}

function build_slideshow(data) {
  console.log("data", data);
  let title = data.title;
  let images = data.images;

  // hide spinner
  document.getElementById('spinner').style.display = 'none';

  // set title
  set_title(title);
  // set stats
  document.getElementById('stats').insertAdjacentHTML('beforeend', generate_stats(data));

  // generate steps
  const steps_container = document.getElementById('steps');
  images.forEach((image, idx) => {
    steps_container.insertAdjacentHTML('beforeend', generate_step(image, idx + 1));
  });

  load_initial_images(steps_container);
}

function set_title(title) {
  document.title = title;

  document.getElementById('title').innerText = title;
}

function generate_stats(data) {
  var date = new Date(data.datetime * 1000);

  return `
    <p>Steps: ${data.images_count} | Author: <a href="https://imgur.com/user/${data.account_url}" target="_blank">${data.account_url}</a> | Date: ${date.toDateString()} | <a href="https://imgur.com/a/${data.id}" target="_blank">Original</a></p>
  `;
}

function generate_step(image, idx) {
  let lazy = idx > 10;

  return `
    <fieldset class="step" id="${image.id}">
      <legend>Step ${idx}</legend>
      <progress id="${'progress-' + image.id}" value="0" max="100" style="width: 100%;"></progress>
      ${media_tag(image, lazy)}
      <p>${image.description}</p>
    </fieldset>
  `;
}

function resize(link, type) {
  // can't resize gifs
  if (type.endsWith('/gif')) {
    return link;
  }

  let url = new URL(link);
  let paths = url.pathname.split(".");

  // s = 90×90
  // b = 160×160
  // t = 160×160
  // m = 320×320
  // l = 640×640
  // h = 1024×1024
  paths[0] += 'l';

  url.pathname = paths.join(".");

  return url.toString();
}

function get_id() {
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get('id');

    return param;
}

function load_initial_images(container) {
  let steps = container.getElementsByClassName('step');

  for (let step of steps) {
    let imgs = step.getElementsByTagName("img");
    let progressBar = step.getElementsByTagName("progress")[0];

    // incase we don't have an image (e.g. video)
    if (imgs.length == 0) {
      progressBar.style.display = 'none';
      continue;
    }

    let imgContainer = imgs[0];
    let imageUrl = imgContainer.dataset.src;

    loadImage(imageUrl, (ratio) => {
      if (ratio == -1) {
        progressBar.removeAttribute('value');
      } else {
        progressBar.value = ratio;
      }
    }).then(imgSrc => {
      imgContainer.src = imgSrc;
    }, xhr => {
      console.error(`Error loading ${imageUrl}`);
    });
  }
}

function best_vid(image) {
  if (image.type.endsWith('gif') && image.mp4) {
    return [image.mp4, "video/mp4"];
  }

  return [image.link, image.type];
}

function media_tag(image, lazy) {
  if (image.type.startsWith('video/') || image.type.endsWith('/gif')) {
    let resp = best_vid(image);
    let link = resp[0];
    let type = resp[1];

    return `
      <video
        poster="${resize(image.link, image.type)}"
        controls
        autoplay
        ${image.looping && "loop"}
      >
        <source src="${link}" type="${type}">
        Your browser does not support the video tag.
      </video>
    `;
  } else if (image.type.startsWith('image/')) {
    let link = image.link;

    return `
      <a href="${link}" target="_blank">
        <img
          src="${resize(link, image.type)}"
          data-src="${link}"
          data-id="${image.id}"
          alt="${image.description}"
          decoding="async"
        />
      </a>
    `;
  } else {
    return `
      <div class="unsupported">Unsupported media type (${image.type}): <a href="${image.link}">${image.link}</a></div>
    `;
  }
}

// Source: https://stackoverflow.com/a/42196770
/**
 * Loads an image with progress callback.
 *
 * The `onprogress` callback will be called by XMLHttpRequest's onprogress
 * event, and will receive the loading progress ratio as an whole number.
 * However, if it's not possible to compute the progress ratio, `onprogress`
 * will be called only once passing -1 as progress value. This is useful to,
 * for example, change the progress animation to an undefined animation.
 *
 * @param  {string}   imageUrl   The image to load
 * @param  {Function} onprogress
 * @return {Promise}
 */
function loadImage(imageUrl, onprogress) {
  return new Promise((resolve, reject) => {
    var xhr = new XMLHttpRequest();
    var notifiedNotComputable = false;

    xhr.open('GET', imageUrl, true);
    xhr.responseType = 'arraybuffer';

    xhr.onprogress = function(ev) {
      if (ev.lengthComputable) {
        onprogress(parseInt((ev.loaded / ev.total) * 100));
      } else {
        if (!notifiedNotComputable) {
          notifiedNotComputable = true;
          onprogress(-1);
        }
      }
    }

    xhr.onloadend = function() {
      if (!xhr.status.toString().match(/^2/)) {
        reject(xhr);
      } else {
        if (!notifiedNotComputable) {
          onprogress(100);
        }

        var options = {}
        var headers = xhr.getAllResponseHeaders();
        var m = headers.match(/^Content-Type\:\s*(.*?)$/mi);

        if (m && m[1]) {
          options.type = m[1];
        }

        var blob = new Blob([this.response], options);

        resolve(window.URL.createObjectURL(blob));
      }
    }

    xhr.send();
  });
}
