<template>
  <details class="player-button-settings">
    <summary>{{ $t('settings.page.playerButtons.title') }}</summary>
    <p>{{ $t('settings.page.playerButtons.hint') }}</p>
    <label v-for="option in options" :key="option.key"
      ><span>{{ $t('settings.page.playerButtons.' + option.key) }}</span
      ><select
        :value="value(option.key)"
        @change="change(option.key, $event.target.value)"
        ><option value="auto">{{
          $t('settings.page.playerButtons.auto')
        }}</option
        ><option value="show">{{
          $t('settings.page.playerButtons.show')
        }}</option
        ><option value="hide">{{
          $t('settings.page.playerButtons.hide')
        }}</option></select
      ></label
    >
  </details>
</template>
<script>
export default {
  name: 'PlayerButtonSettings',
  data() {
    return {
      options: [
        { key: 'previous' },
        { key: 'next' },
        { key: 'like' },
        { key: 'queue' },
        { key: 'repeat' },
        { key: 'shuffle' },
        { key: 'volume' },
        { key: 'lyrics' },
        { key: 'fmTrash' },
      ],
    };
  },
  methods: {
    value(key) {
      const value = this.$store.state.settings.playerButtons?.[key];
      return value === true ? 'show' : value === false ? 'hide' : 'auto';
    },
    change(key, choice) {
      const value = { ...this.$store.state.settings.playerButtons };
      if (choice === 'auto') delete value[key];
      else value[key] = choice === 'show';
      this.$store.commit('updateSettings', { key: 'playerButtons', value });
    },
  },
};
</script>
<style lang="scss" scoped>
.player-button-settings {
  margin: 0;
  color: var(--color-text);
  border-top: 1px solid rgba(128, 128, 128, 0.1);
  summary {
    cursor: pointer;
    padding: 16px 0 12px;
    font-size: 15px;
    font-weight: 550;
  }
  p {
    margin: 0 0 12px;
    font-size: 12px;
    line-height: 1.55;
    opacity: 0.6;
  }
  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 0;
    padding: 12px 0;
    border-top: 1px solid rgba(128, 128, 128, 0.08);
    font-size: 13px;
  }
  select {
    width: 180px;
    min-width: 140px;
    max-width: 100%;
    color: var(--color-text);
    border: 1px solid rgba(128, 128, 128, 0.1);
    background-color: var(--color-secondary-bg);
    border-radius: 10px;
    padding: 11px 34px 11px 13px;
    font-size: 14px;
    font-weight: 500;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m1 1 4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 13px center;
    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  }
}
@media (max-width: 600px) {
  .player-button-settings select {
    width: 142px;
    min-width: 0;
    font-size: 13px;
    padding-left: 10px;
  }
}
@media (max-width: 360px) {
  .player-button-settings select {
    width: 122px;
  }
}
</style>
