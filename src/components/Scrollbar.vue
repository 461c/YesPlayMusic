<template><span aria-hidden="true" style="display: none"></span></template>
<script>
// Scroll-position storage only. The app shell owns the sole visible drag handle.
export default {
  name: 'Scrollbar',
  data() {
    return { positions: {} };
  },
  computed: {
    main() {
      return this.$parent.$refs.main;
    },
  },
  methods: {
    handleScroll() {
      if (this.$route.meta.savePosition)
        this.positions[this.$route.fullPath] = this.main.scrollTop;
    },
    restorePosition() {
      const saved = this.positions[this.$route.fullPath];
      if (this.$route.meta.savePosition && saved !== undefined && this.main)
        this.main.scrollTo({ top: saved });
    },
  },
};
</script>
