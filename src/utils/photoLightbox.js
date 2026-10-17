import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';

let active;
export function photoSource(pic) {
  if (!pic) return null;
  const url =
    typeof pic === 'string'
      ? pic
      : pic.originUrl || pic.originalUrl || pic.squareUrl || pic.picUrl;
  if (!url || !/^https?:\/\//.test(url)) return null;
  return {
    original: url.replace(/^http:/, 'https:'),
    src:
      url.replace(/^http:/, 'https:') +
      (window.YesPlayMusicAndroid
        ? (url.includes('?') ? '&' : '?') + 'ypmPhoto=1'
        : ''),
    width: Number(pic.width) || 1200,
    height: Number(pic.height) || 1200,
    alt: '照片',
  };
}
export function closePhotos() {
  if (!active?.pswp) return false;
  active.pswp.close();
  return true;
}
window.__closePhotoLightbox = closePhotos;
export function openPhotos(pictures, index = 0) {
  const dataSource = pictures.map(photoSource).filter(Boolean);
  if (!dataSource.length) return;
  active?.destroy();
  const lightbox = new PhotoSwipeLightbox({
    dataSource,
    pswpModule: () => import('photoswipe'),
    bgOpacity: 0.95,
    showHideAnimationType: 'fade',
    showAnimationDuration: 160,
    hideAnimationDuration: 120,
    closeTitle: '关闭',
    zoomTitle: '缩放',
    arrowPrevTitle: '上一张',
    arrowNextTitle: '下一张',
    errorMsg: '照片尚未保存，或暂时无法加载',
    paddingFn: () => ({ top: 70, bottom: 24, left: 12, right: 12 }),
  });
  active = lightbox;
  lightbox.on('uiRegister', () => {
    lightbox.pswp.ui.registerElement({
      name: 'save-photo',
      order: 8,
      isButton: true,
      html: '下载',
      onClick: async () => {
        const src =
          lightbox.pswp.currSlide.data.original ||
          lightbox.pswp.currSlide.data.src;
        if (window.YesPlayMusicAndroid?.savePhoto) {
          window.YesPlayMusicAndroid.savePhoto(src);
          return;
        }
        try {
          const response = await fetch(src);
          if (!response.ok) throw new Error('下载失败');
          const url = URL.createObjectURL(await response.blob());
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'YesPlayMusic-' + Date.now() + '.jpg';
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch (_) {
          window.open(src, '_blank', 'noopener');
        }
      },
    });
  });
  // Correct aspect ratio from the actual cached image, including older resized entries.
  lightbox.on('contentLoadImage', ({ content }) => {
    const image = content.element;
    if (!image) return;
    image.addEventListener(
      'load',
      () => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        content.data.width = image.naturalWidth;
        content.data.height = image.naturalHeight;
        if (content.slide) {
          content.width = content.slide.width = image.naturalWidth;
          content.height = content.slide.height = image.naturalHeight;
          content.slide.resize();
        }
      },
      { once: true }
    );
  });
  lightbox.init();
  lightbox.loadAndOpen(Math.max(0, Math.min(index, dataSource.length - 1)));
}
