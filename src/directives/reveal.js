// Route transitions handle navigation; these hooks handle content revealed after async data.
const pageAnimations = new WeakMap();
const images = new WeakMap();
const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const pageReveal = {
  componentUpdated(el, binding) {
    if (binding.value === binding.oldValue) return;
    pageAnimations.get(el)?.cancel();
    if (!binding.value || reducedMotion() || !el.animate) return;
    const animation = el.animate(
      [
        { opacity: 0, transform: 'translateY(5px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 140, easing: 'ease-out' }
    );
    pageAnimations.set(el, animation);
  },
  unbind(el) {
    pageAnimations.get(el)?.cancel();
    pageAnimations.delete(el);
  },
};

const sourceKey = el =>
  ['src', 'srcset', 'sizes']
    .map(name => el.getAttribute(name) || '')
    .join('\n');

function resetImage(el) {
  const state = images.get(el);
  const key = sourceKey(el);
  if (state.key === key) return;
  state.key = key;
  state.generation++;
  state.revealed = false;
  state.animation?.cancel();
  el.setAttribute('data-image-pending', '');
  if (el.complete && el.naturalWidth > 0) state.loaded();
}

export const imageFade = {
  bind(el) {
    const state = { key: null, generation: 0, revealed: false };
    state.loaded = async () => {
      const generation = state.generation;
      if (!el.complete || el.naturalWidth <= 0 || state.revealed) return;
      // Decode before revealing, including images already in the browser cache.
      if (el.decode) {
        try {
          await el.decode();
        } catch (_) {
          // Some WebViews reject decode() even after a successful load.
        }
      }
      if (
        images.get(el) !== state ||
        generation !== state.generation ||
        sourceKey(el) !== state.key ||
        !el.complete ||
        el.naturalWidth <= 0 ||
        state.revealed
      )
        return;
      state.revealed = true;
      el.removeAttribute('data-image-pending');
      if (!reducedMotion() && el.animate) {
        state.animation = el.animate(
          [{ opacity: 0 }, { opacity: getComputedStyle(el).opacity }],
          { duration: 180, easing: 'ease-out' }
        );
      }
    };
    state.failed = () => {
      state.generation++;
      el.removeAttribute('data-image-pending');
    };
    images.set(el, state);
    el.addEventListener('load', state.loaded);
    el.addEventListener('error', state.failed);
    resetImage(el);
  },
  componentUpdated: resetImage,
  unbind(el) {
    const state = images.get(el);
    state.animation?.cancel();
    el.removeEventListener('load', state.loaded);
    el.removeEventListener('error', state.failed);
    el.removeAttribute('data-image-pending');
    images.delete(el);
  },
};
