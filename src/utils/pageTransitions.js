// Browser snapshots keep the outgoing content visible while an async route reveals.
export function waitForPageContent(main, timeout = 3200) {
  return new Promise(resolve => {
    let timer;
    const observer = new MutationObserver(check);
    function done() {
      clearTimeout(timer);
      observer.disconnect();
      resolve();
    }
    function check() {
      const page = main.firstElementChild;
      if (
        !page ||
        page.classList.contains('page-leave-active') ||
        getComputedStyle(page).display === 'none' ||
        page.dataset.pageReady === 'false'
      )
        return;
      done();
    }
    observer.observe(main, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'data-page-ready'],
    });
    timer = setTimeout(done, timeout);
    check();
  });
}
export function installPageTransitions(router, app) {
  let transition,
    sequence = 0;
  const remove = router.beforeResolve((to, from, next) => {
    if (
      !document.startViewTransition ||
      !app.$refs.main ||
      !from.name ||
      app.$store.state.showLyrics ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      next();
      return;
    }
    transition?.skipTransition();
    const generation = ++sequence;
    let advanced = false;
    document.documentElement.setAttribute('data-page-transition', '');
    try {
      transition = document.startViewTransition(async () => {
        advanced = true;
        next();
        await app.$nextTick();
        await waitForPageContent(app.$refs.main);
      });
      transition.ready.catch(() => {});
      transition.finished
        .catch(() => {})
        .finally(() => {
          if (generation === sequence)
            document.documentElement.removeAttribute('data-page-transition');
        });
    } catch (_) {
      document.documentElement.removeAttribute('data-page-transition');
      if (!advanced) next();
    }
  });
  return () => {
    sequence++;
    transition?.skipTransition();
    document.documentElement.removeAttribute('data-page-transition');
    remove();
  };
}
