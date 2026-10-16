<template>
  <details class="player-button-settings">
    <summary>播放栏按钮</summary>
    <p>播放/暂停始终显示；自动使用当前设备的默认布局。</p>
    <label v-for="option in options" :key="option.key"
      ><span>{{ option.title }}</span
      ><select
        :value="value(option.key)"
        @change="change(option.key, $event.target.value)"
        ><option value="auto">自动</option
        ><option value="show">显示</option
        ><option value="hide">隐藏</option></select
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
        { key: 'previous', title: '上一首' },
        { key: 'next', title: '下一首' },
        { key: 'like', title: '喜欢歌曲' },
        { key: 'queue', title: '播放队列' },
        { key: 'repeat', title: '循环播放' },
        { key: 'shuffle', title: '随机播放' },
        { key: 'volume', title: '音量' },
        { key: 'lyrics', title: '展开歌词' },
        { key: 'fmTrash', title: '私人 FM 不喜欢' },
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
  margin: 24px 0;
  color: var(--color-text);
  summary {
    cursor: pointer;
    font-weight: 600;
    padding: 10px 0;
  }
  p {
    font-size: 13px;
    opacity: 0.6;
    margin: 8px 0 14px;
  }
  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 14px 0;
    font-size: 14px;
  }
  select {
    min-width: 120px;
    color: var(--color-text);
    border: none;
    background: var(--color-secondary-bg);
    border-radius: 8px;
    padding: 8px 12px;
  }
}
</style>
