<template>
  <section class="settings-card settings-sync">
    <h4 class="card-heading">同步设置</h4>
    <p
      >手动导入或导出，云盘保留一份设置
      MP3。包含已添加用户及其排序，不包含登录信息、歌曲和图片缓存。</p
    >
    <div class="sync-actions">
      <button :disabled="busy !== ''" @click="sync('export')">{{
        busy === 'export' ? '正在导出…' : '导出到云盘'
      }}</button>
      <button :disabled="busy !== ''" @click="sync('import')">{{
        busy === 'import' ? '正在导入…' : '从云盘导入'
      }}</button>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
  </section>
</template>
<script>
import request from '@/utils/request';
import {
  trackingScope,
  readTrackingList,
  saveTrackingList,
  normalizeTrackingId,
} from '@/utils/trackingStore';
import { isAccountLoggedIn } from '@/utils/auth';
import { archiveMode } from '@/utils/archiveMode';
export default {
  name: 'SettingsSync',
  data() {
    return { busy: '', message: '' };
  },
  methods: {
    async sync(operation) {
      if (this.busy) return;
      if (!isAccountLoggedIn()) {
        this.message = '请先登录网易云账号';
        return;
      }
      if (archiveMode()) {
        this.message = '请先关闭纪念模式';
        return;
      }
      if (window.YesPlayMusicAndroid?.getApiUrl?.()) {
        this.message = '设置同步需要使用内置音乐接口';
        return;
      }
      const account = String(this.$store.state.data.user?.userId || '');
      this.busy = operation;
      this.message = '';
      try {
        const scope = trackingScope(account);
        const people = await readTrackingList(scope);
        const settings = JSON.parse(JSON.stringify(this.$store.state.settings));
        const result = await request({
          url: '/ypm/settings/sync',
          method: 'post',
          data: {
            operation,
            ...(operation === 'export' ? { settings, people } : {}),
          },
          params: { timestamp: Date.now() },
          timeout: 240000,
          skipAuthRedirect: true,
        });
        if (account !== String(this.$store.state.data.user?.userId || ''))
          throw new Error('账号已切换，本次结果未应用');
        if (result.code !== 200) throw new Error(result.message || '同步失败');
        if (operation === 'import') {
          const imported = result.snapshot?.settings;
          if (
            !imported ||
            typeof imported !== 'object' ||
            Array.isArray(imported)
          )
            throw new Error('设置备份格式无效');
          // Only existing setting names may be applied. Account/player/library data is never imported.
          for (const key of Object.keys(settings)) {
            if (
              /cookie|token|password|secret|^(__proto__|constructor|prototype)$/i.test(
                key
              )
            )
              continue;
            if (Object.prototype.hasOwnProperty.call(imported, key))
              this.$store.commit('updateSettings', {
                key,
                value: imported[key],
              });
          }
          if (Array.isArray(result.snapshot.people)) {
            const seen = new Set();
            const users = result.snapshot.people.filter(person => {
              const id = normalizeTrackingId(person.id);
              if (!id || seen.has(id)) return false;
              seen.add(id);
              return true;
            });
            await saveTrackingList(scope, users);
          }
          this.message = '设置已导入，正在重新加载…';
          window.location.reload();
        } else
          this.message =
            result.warning || '设置已导出并校验，云盘保留最新一份备份';
      } catch (error) {
        this.message = error.message || '设置同步失败，请重试';
      } finally {
        this.busy = '';
      }
    },
  },
};
</script>
<style lang="scss" scoped>
.settings-sync {
  color: var(--color-text);
  p {
    font-size: 13px;
    line-height: 1.65;
    opacity: 0.65;
  }
}
.card-heading {
  margin: 0 0 4px;
  padding-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  opacity: 0.56;
}
.sync-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
  button {
    padding: 10px 14px;
    border: 1px solid rgba(128, 128, 128, 0.1);
    border-radius: 10px;
    color: var(--color-text);
    background: var(--color-secondary-bg);
    font-size: 13px;
    font-weight: 550;
    cursor: pointer;
  }
  button:hover {
    color: var(--color-primary);
    background: var(--color-primary-bg);
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
}
</style>
