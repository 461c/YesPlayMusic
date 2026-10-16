<template>
  <div v-page-reveal class="tracking-page">
    <header>
      <h1
        ><img
          v-if="!managing && selectedUser.avatar"
          v-image-fade
          class="tracking-avatar"
          :src="selectedUser.avatar | resizeImage(96)"
          alt=""
        />{{
          managing
            ? '管理跟踪'
            : selected
            ? (selectedUser.alias || selectedUser.name || selected) + '的跟踪'
            : '跟踪'
        }}</h1
      >
      <div class="header-actions">
        <template v-if="!managing">
          <select
            v-if="users.length"
            :value="selected"
            aria-label="切换用户"
            @change="selectUser($event.target.value)"
            ><option v-for="user in users" :key="user.id" :value="user.id">{{
              user.alias || user.name || user.id
            }}</option></select
          >
          <button @click="managing = true">管理</button>
        </template>
        <button v-else @click="managing = false">返回</button>
      </div>
    </header>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <div v-if="managing" key="management" v-page-reveal>
      <form class="add-user" @submit.prevent="addUser()"
        ><input
          v-model="inputId"
          inputmode="numeric"
          aria-label="用户 ID"
          placeholder="用户 ID"
        /><button :disabled="!ready">添加</button></form
      >
      <div v-for="(user, index) in users" :key="user.id" class="managed-user">
        <template v-if="editing === user.id">
          <form class="edit-user" @submit.prevent="saveEdit(user.id)"
            ><input
              v-model="editId"
              aria-label="修改用户 ID"
              inputmode="numeric"
              placeholder="用户 ID"
            /><input
              v-model="editAlias"
              aria-label="备注"
              placeholder="备注"
            /><button>保存</button
            ><button type="button" @click="editing = ''">取消</button></form
          >
        </template>
        <template v-else>
          <div class="person"
            ><img
              v-if="user.avatar"
              v-image-fade
              :src="user.avatar | resizeImage(96)"
              alt=""
            /><span
              >{{ user.alias || user.name || user.id
              }}<small>ID {{ user.id }}</small></span
            ></div
          >
          <div class="person-actions"
            ><button @click="edit(user)">修改</button
            ><button :disabled="index === 0" @click="move(index, -1)"
              >上移</button
            ><button
              :disabled="index === users.length - 1"
              @click="move(index, 1)"
              >下移</button
            ><button @click="remove(user.id)">删除</button></div
          >
        </template>
      </div>
    </div>
    <template v-else>
      <div v-if="selected" :key="selected" v-page-reveal>
        <div class="groups tabs" role="tablist" aria-label="内容分组"
          ><button
            v-for="item in groups"
            :key="item.key"
            role="tab"
            :aria-selected="group === item.key"
            :class="{ active: group === item.key }"
            @click="group = item.key"
            >{{ item.title }}</button
          ></div
        >
        <div :key="group" v-page-reveal>
          <template v-if="group === 'activity'">
            <TrackingSection
              :uid="selected"
              :scope="scope"
              section="profile"
              title="资料"
              @profile="updateProfile"
              @notice="notice = $event"
            />
            <TrackingSection
              :uid="selected"
              :scope="scope"
              section="events"
              title="动态"
              @notice="notice = $event"
            />
          </template>
          <template v-else-if="group === 'playlists'">
            <TrackingSection
              :uid="selected"
              :scope="scope"
              section="playlists"
              title="歌单"
              @notice="notice = $event"
            />
          </template>
          <template v-else>
            <div class="rank-range"
              ><button
                :class="{ active: rank === 'week' }"
                @click="rank = 'week'"
                >最近一周</button
              ><button :class="{ active: rank === 'all' }" @click="rank = 'all'"
                >所有时间</button
              ></div
            >
            <TrackingSection
              :uid="selected"
              :scope="scope"
              :section="rank"
              title="听歌排行"
              @notice="notice = $event"
            />
          </template>
        </div>
      </div>
      <button v-else-if="ready" class="empty-add" @click="managing = true"
        >添加用户</button
      >
    </template>
  </div>
</template>
<script>
import TrackingSection from '@/components/TrackingSection.vue';
import {
  trackingScope,
  normalizeTrackingId,
  readTrackingList,
  saveTrackingList,
  deleteTrackingSnapshots,
} from '@/utils/trackingStore';
export default {
  name: 'Tracking',
  components: { TrackingSection },
  data() {
    return {
      users: [],
      selected: '',
      inputId: '',
      ready: false,
      notice: '',
      managing: false,
      editing: '',
      editId: '',
      editAlias: '',
      group: 'activity',
      rank: 'week',
      scopeGeneration: 0,
      listWrites: Promise.resolve(),
      groups: [
        { key: 'activity', title: '动态与资料' },
        { key: 'playlists', title: '歌单' },
        { key: 'listening', title: '听歌' },
      ],
    };
  },
  computed: {
    scope() {
      return trackingScope(this.$store.state.data?.user?.userId);
    },
    selectedUser() {
      return this.users.find(user => user.id === this.selected) || {};
    },
  },
  watch: {
    scope: {
      immediate: true,
      handler() {
        this.restore();
      },
    },
  },
  beforeDestroy() {
    this.scopeGeneration++;
  },
  methods: {
    async restore() {
      const epoch = ++this.scopeGeneration;
      this.users = [];
      this.selected = '';
      this.ready = false;
      this.notice = '';
      this.editing = '';
      const users = await readTrackingList(this.scope);
      if (epoch !== this.scopeGeneration) return;
      this.users = users
        .filter(user => normalizeTrackingId(user.id))
        .map(user => ({ alias: '', ...user }));
      this.ready = true;
      if (this.users.length) this.selectUser(this.users[0].id);
    },
    persist() {
      const scope = this.scope,
        users = JSON.parse(JSON.stringify(this.users));
      this.listWrites = this.listWrites
        .catch(() => {})
        .then(() => saveTrackingList(scope, users))
        .catch(() => {
          if (scope === this.scope) this.notice = '列表保存失败';
        });
    },
    selectUser(id) {
      if (!this.users.some(user => user.id === id)) return;
      this.selected = id;
      this.group = 'activity';
      this.rank = 'week';
      this.notice = '';
    },
    addUser() {
      if (!this.ready) return;
      const id = normalizeTrackingId(this.inputId);
      if (!id) {
        this.notice = '请输入有效的用户 ID';
        return;
      }
      if (this.users.some(user => user.id === id)) {
        this.notice = '用户已存在';
        return;
      }
      this.users.push({ id, name: '', avatar: '', alias: '' });
      this.inputId = '';
      this.persist();
      this.selectUser(id);
    },
    edit(user) {
      this.editing = user.id;
      this.editId = user.id;
      this.editAlias = user.alias || '';
      this.notice = '';
    },
    saveEdit(oldId) {
      const id = normalizeTrackingId(this.editId);
      if (!id) {
        this.notice = '请输入有效的用户 ID';
        return;
      }
      if (this.users.some(user => user.id === id && user.id !== oldId)) {
        this.notice = '用户已存在';
        return;
      }
      const index = this.users.findIndex(user => user.id === oldId);
      if (index < 0) return;
      const old = this.users[index];
      this.$set(this.users, index, {
        id,
        name: id === oldId ? old.name : '',
        avatar: id === oldId ? old.avatar : '',
        alias: this.editAlias.trim(),
      });
      if (id !== oldId)
        deleteTrackingSnapshots(this.scope, oldId).catch(() => {});
      if (this.selected === oldId) this.selectUser(id);
      this.editing = '';
      this.notice = '';
      this.persist();
    },
    remove(id) {
      this.users = this.users.filter(user => user.id !== id);
      this.persist();
      deleteTrackingSnapshots(this.scope, id).catch(() => {});
      if (this.selected === id) {
        this.selected = '';
        if (this.users.length) this.selectUser(this.users[0].id);
      }
    },
    move(index, delta) {
      const next = index + delta;
      if (next < 0 || next >= this.users.length) return;
      const users = this.users.slice();
      [users[index], users[next]] = [users[next], users[index]];
      this.users = users;
      this.persist();
    },
    updateProfile({ uid, profile }) {
      const user = this.users.find(user => user.id === uid);
      if (!user) return;
      user.name = profile.nickname || '';
      user.avatar = profile.avatarUrl || '';
      this.persist();
    },
  },
};
</script>
<style lang="scss" scoped>
.tracking-page {
  color: var(--color-text);
  padding-bottom: 32px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 28px 0;
}
.header-actions,
.person-actions,
.add-user,
.edit-user,
.groups,
.rank-range {
  display: flex;
  align-items: center;
  gap: 8px;
}
button,
input,
select {
  color: var(--color-text);
  font: inherit;
  border: none;
  border-radius: 8px;
  background: var(--color-secondary-bg);
  padding: 10px 14px;
  min-width: 0;
}
button:disabled {
  opacity: 0.35;
}
button:focus-visible,
input:focus,
select:focus {
  outline: 2px solid var(--color-primary);
}
select {
  max-width: 240px;
}
.person-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 20px 0;
  a {
    font-size: 13px;
    color: var(--color-primary);
  }
}
.groups {
  flex-wrap: wrap;
  margin-bottom: 28px;
}
.active {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}
.rank-range {
  justify-content: flex-end;
  margin-top: 32px;
}
.add-user {
  margin: 24px 0;
  input {
    flex: 1;
    max-width: 400px;
  }
}
.managed-user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}
.person {
  display: flex;
  align-items: center;
  gap: 12px;
  img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }
  small {
    display: block;
    font-size: 12px;
    opacity: 0.6;
    margin-top: 5px;
  }
}
.edit-user {
  flex-wrap: wrap;
  width: 100%;
  input {
    flex: 1;
  }
}
.notice {
  margin: 12px 0;
  opacity: 0.7;
}
.empty-add {
  display: block;
  margin: 60px auto;
}
@media (max-width: 650px) {
  select {
    max-width: 155px;
  }
  .person-actions {
    flex-wrap: wrap;
  }
  h1 {
    font-size: 26px;
  }
}
</style>

<style lang="scss" scoped>
header h1 {
  font-size: 42px;
  color: var(--color-text);
  display: flex;
  align-items: center;
  min-width: 0;
  overflow-wrap: anywhere;
}
.tracking-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
}
.groups {
  margin-top: 32px;
  margin-bottom: 24px;
  gap: 14px;
}
.groups button {
  opacity: 0.68;
  font-weight: 600;
  font-size: 18px;
  padding: 8px 14px;
  background: transparent;
  color: var(--color-text);
}
.groups button.active {
  opacity: 1;
  background: var(--color-secondary-bg);
}
@media (max-width: 600px) {
  header {
    flex-wrap: wrap;
  }
  header h1 {
    font-size: 26px;
  }
  .groups {
    gap: 6px;
  }
  .groups button {
    font-size: 15px;
  }
}
</style>
