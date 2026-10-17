<template>
  <div class="settings-page" @click="clickOutside"
    ><div class="container"
      ><header class="settings-heading"><h1>设置</h1></header
      ><div v-if="showUserInfo" class="user">
        <div class="left">
          <img
            v-image-fade
            class="avatar"
            :src="data.user.avatarUrl"
            loading="lazy"
          />
          <div class="info">
            <div class="nickname">{{ data.user.nickname }}</div>
            <div class="extra-info">
              <span v-if="data.user.vipType !== 0" class="vip"
                ><img
                  v-image-fade
                  class="cvip"
                  src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHIAAAA8CAYAAAC6j+5hAAAQK0lEQVR4AXzNh5WDMAwA0Dv3Su+wIfuxC3MwgCMUOz3xe1/N7e/X0lovhJCVUroR8r9DfVBKAuQAM8QYQ4815wlHQqQsIh6kFEA+USpRCP4H92yMfmCCtScL7rVzd967Fz5kmcf6zHmeJdDf66LIowJzWd5zUlUlqmsU6wo1TVI/adsmutZd1z7p+6Q7HePY7WCbpmGd53kBF87L4yiTMAaiM+u9N2NTIpB1CZEHuZAGHLFS8T9UXdJqzeHRw5VX3Z8YAIAPwf5Ii8k6Hsfx0nBxgEQwcWQIDKGPEZolAhIRGLg8hCaJUEuEVwhFIN8QMkOgfXsCApNESBLj+yNCEYjEg0iRicB7mdP05T7n+eulcbzv+2IMAHyAF/HI5J2pwBGBpIA4iCZqGwF5yKSJ4AJpIm1EoCfytJWAwKqN8MZRmYEIpI0IJCuJtUD/VoGIQ6aL01Yi8OuBu+95nlzo2bIsR8bggPxikn6ZwGuXiEhS2+iJQBKJEEJpIm1Epksr2ggiEanIRGDRRhCJuY1Znjaxm9R3CCRTIxHZtTHJI0MkbUQqMq+2bfllDMAHTbwax0HlZYGBymRWaaOIDIFQy/SkjaBtlFlFpgjs2whlE0nEQddGEonN24hAaWaSSQOjic5EwhXNpJH+JrrJw5yWbQQRiEQE0kJLREobEcmcIhGB8i7KpCIUkQhEome0MLJ5G7PAto2Q55TvaGHTxlqivItdG0PksszOGW/m4D/8sGFOQ55KzE0ko4UqE4nayHypIq6eVARGC5V+UmuBKjLkBe2kCv2kaiMRWM+qg0RQgZ7LMgm2pseHRR0247ITmY8cBPazqu+iytRGqlBE5neRpIX9rML/zCqJRJWZGwkqEJAY6QL7WSWRKDJppH9f+r8mLvJ7SASuVEQmiWRqIdBEMq7U30+qkie1eRdFHDKZVY6bflIVJEL9LqYWAgJJmthMqkITSZfnIpHoua53Mm1dv7vIk9RGoZeISEAc06qNdLSFJKhAeEGmS5VUoSGwnlZklm+jkJv4vrtUmVJ5H2li9zaCCtRGIhKZiNy2+WQweachEZDYzik0bcxXKvRtVImAxPrASXPqQvsDp34j2ybWIj8mEAdVG0kOHG0jTEATaSNprKcu8vxPVyoJWSIp72N55HCx1lcqqZNKBkh0uFJJlRm8kXntr9TyfYQkkfRG6vuYr1Tex6KJJDKrIwehNNJYPM+HelZDHO8jLSSdW1rOAci5bYnCeSprmLHtubbte8fXtm3btm3btm3bxq/9TqfeqtpZ0+fszrs5VbUqU+Pkq9W9GzsCjAUnAmJ1Nus2mZpwKy29FOfGHLhrzz7duU8+SNQN553NuREdHF++E0O/k0GGvp9zIz5v1q9vv+befewhd+9Vl7s9t9vaDfX3CjA+qSpOzMblRoEIkC7DAFmAyG7kniogwo1rrriCe+T6a9zsj9/PPZGvX3rO1VZX+zBF8jn5WvCF2GhyDDD1vEgK/D7qq4ZBUngNwwto1kfvuUtPOdEN9PVwucGhFW5kmJCUIADJYTW5gxNX/IuWX2Jx99wdt6r//LVnn6EW/2uvuUbwiX//6kuupamRa0bOkciLZpAIp4Hv51IjDMuoX956za0/PqrmRg6nDJBBAiLlREgrN/7DbszlsWP328fNSf7HI2ir84RDJJCDT/rOyy4OuhGh1Q7S5kguN+ywwpKotc8O29MJFQLE/NwIIbxmeMIh0ro3eOR2nLgxGyXwJ2+5MfgPI8TW1VTjgAPJ50whdusN1wNMbd5odiSfUI0gi+tIgrnBxCi14UheyQEnQhkPIh1wfKDxJ9Wy0lKEUrOuOycXYnlobAqxP73xiutqb6cuDp1SCwNpciSfVIsNEmF2aKBPYHITAADJkR5Ia2Oc2nAicYbZiax11lpDAHJP1RRiH7z2KgHHDQAopRwpANMDCV16yknkyGrfjb4TPZi1cCTgadP/eDcef8B+2j9jDrH1tbU8ppLPmULsLltuFjemsoJEWDWD9GGmARGn2bkGByi0JrmRQHLxDyeKGKBoyYUXQmkR1IwP3sk5bYPodNbf3eXK5UUpFZWoM0dxa+h3/vbOG26wr0eFmUKO9N1oduRnzz3ltlh/Hdff2xWpO/p4Xflc8Of22n4bv4vDAEV6jgTAUE/VB/rqfXeZnsyN553jujva1U4OQqrXS0Vz3BRin7j5BoADSCn0LSC5DWd1JDo4Jogd7S1S7Od1cro624Iw77v6coDk3KhCrK+PHOkfbPDoO1Fz5GrLLWs6he213dYo/rkVR06cDrOhzhZi991xe3VEZQeZjiPFiRhVcStuyw3WTfpZ6QAlFv8C04coUnOk1orzYErHJvhE9tx2a2W9EY88+dd3cdZZa83g3/nzvbfcvMODfk81FZCAaD3s9PV0+U7Ma44P9HUH2nmvx9SNeQccypGASNJqRlF9bY0hnJ4NgDzhiHMjT/5RK5pC7PN33hbBKMGIKo3QSpONIEjJizzhgKQtFyxDuGZEbqSQKhDhyPCoCk4UbTg+FjzYSE7k5jitccTuqQIgmuON9fWmEHvYnrv5k400cqQ33TCHVlHBofW9xx/i5jhcySA5R8aXGzxnvOTk4xP/CXEQb8RBbSWl7soFFnKfrriySD6Wz8W6EUX/uiNrmk7Giy4wnxlkaWlBIOFEE0gcdjo7WqdB7OpsNxx2rvDdGIIYqU5AMsT4/Ch66tbkBsAG4yPiRjqlCsQS983Kq7lZa4z4ks8BproBgML/+nPPCr54r91/j7zIZkdi6p9GaAVMcZ+UHpIX5WNL+bH3DtvEnlIRXhFSIYAUEcD8HIlB8fuPP5Kc5Lu6ABESmOI+hgjJ12K34qCmhgb3zcvPB1+E4w/cvwCQJWaQvBWXZkNg7qFBdcIB4aBDIP+plBsifdlYTlSJIaukhPOj5EUJpbEgP1tpZUAEUHUrbr3REdMLsfSiCxvni/bQynuqaYG87NSTqOSoCUJsaJDQ6hf/BJDyo0hOVMmHgtJSbQ8nAHKVWIAkU4h959EHzYNi68Sfd1TTaprPNdTvQ4T4pKqDFGlb4yK+FvfWw/cXFFrhyCsXWDAQWnnFUQVqDrEp5EiBia24VMZYG06O8SEHEBmmp7qcMur9Rs+FDFImD6HDjlcv4lEONLGHnfbSMnZjTgO93dqYyhRirY40zhd5M67YEKVDpdaMHFbhSDgRyuQ3xmn1X1lvlD0Tw6xRxOuNavnRXoryI38rTnT7JRcKNED0B8fBEGsHaXIkrzYWNZyKE7nUYKAAqIVVP0f6YoD+jSpTQ6Cns523xRPvNwo0rh2H+/vdzA/fjcLocxJOARBFv+zvBEJsUXMk398o0vLVSW54sE8g+opx5LRwio/hSMDzICq5EarKVsgLHJx4xF8Zt12Ju+eKS/H7xH0CkmHKWOxvgERYNYGkPdWwI2UH5+4rLnEfPvloNHJ7XU770gyXyYaMqaISY4CHxtxP5ZOqyIdJoZUmHH7JAfGi8QPXXBkuarffBj1VBaAOE2H1/OOPnvb71h8bQVM8D+YN56khttjrjbRoHAbJq43+1F/ZACCIITcqOZLcCKluBMixVVc2jrG2ITcq9xsppB6z397q75Mw2tzYQNvi5hAb2MGxO9IOEvcb4y7jVAMiL1R5j8iN+e04htjYWA+Q8SEVjuT7G4/fdL15sNzb1eE7Ug2r3R0dcriJ/T0Isdp1uA2Qt+3iG1UFOjKYIwFOcyQ7kdwYLP4prNYDJOVIAklhFTBl1cP0guEAdN05Z+a2xQd6elylHBrKyyLAndHnxuXaQCjv+iHWv0kFybWC/8eRVpCAiEcrSEA0bsWFW3GcH6FM+A5H/P3GUw49iJ5A+jrugH3V+42tzU3GEAuQhS0c+/cbs9kgSADE0jEgJk3+qTEuwIIhlUIrhVUA1K7G+beMJVTeeyVOl+nrxvPPATwGiRCbYo4UiObQGroax4NjiJ0IoBxa40H6SoLIN6qy0ZN648H7UgWIRSt5IQNv4IAQW+yFY1yHM4NkiOEDTtz0H1Lc6OfIuHfh8E+peIT4fqPAvPfKy1KDKDtCjQ31gJh4v7GtpRkhtphbcXRJ1Q5SoOExfr1Rg8nlRh2UBxPKBJzofUxupOm/nECLnTP/ev9tt99O26sA8cgwRRtOjJmXqSALSH8rLgzSfr8RUpxIboTqFZBKbiSgAAiY6h4OCn85zUoYDIMKT/sXnm8e1IxBN7ICIVbgFRhaAbEgR1JeFMXu4XAHh5vjihuhBpcBRN2RajhVt+L47v/E6qvKpMRUVkBzIj15yw1Ro3yt8Ds3Bt7cqL21JSnEem4sNQ2KPTdaHQl4BDAUVuHC+HCKvAg1Nf0PpPYOHPwuVfFujN8aF9VGT2KTqUl3+WknuYevv9q9/cgDuY6/7KN+9eIz7qV77owWuk50O22+qetsa7W+Jw5JvfMvNaoxR9pDK94Lxx5aATHgxsAhh2GyMv9t7WxS2wiiINw7ZxOyT/w3YPBtdBGDL+R76C66hrWVIO8FCgq+rtYgsvimtS/qve7XM6US7MwBgDkSvbF5gAPtN6Y39wYbsaT+WubFuZiMUkFeHN6Ms2sqpFOlYKMC47j1FEdizu8bGwrI3apKartx257PowQ7lYjY4HAI8MMdaXAwznEcRWQU59SJWnF+FBQQUWOzdCrgAjJuTALKkauYsQZDAIgouEvFgNwEpCNLyOLl1I48tmgG+uL8+43GX/8PjuTtRkioEkipWuWo7gz+25/eSAGXOaruROFOhBvDq422copDAZ8bE/PlOEqkjxDDieNG4WKG0L+b943ThCriQu51Y44aW6cau4hCgsKNtSY3akWAA/qjCQg3srQmN6q0vnz8yy2vHnmZhf7xRePbeXFaeU1FN2YxZ72RrKPG5EQK6Hh/VFmVA11IwbJKMfmlMXeo7JGroTg2N94jL29vb4+jHqPE+rIjR3Rj/UY55feNdKNhIv5s1jGc+3vjMvjPmAXFe2qjpVPBjchTDVlxcGMex/2ZnRlttd6Y3fhVjNGPDt4t8b6xW4WAKYIzlVQ48u4IznBmDBmqaYOTs1QpplwJAdMmR3he3NSRTiqpBgSsVSJ+v7+//y7G6EdRYj4cypVXllXvi3Ckwe8b2Rc99T86EvyHshr6I3qkC5i+b8TNfyir6Ita3YUU83ElpAt63bbtUIymH6L75WcJeGUMpztxUVJ53AiZOLsF1JpSjbWClGrMGE4mNzIwPvRFzFKdUFLhRo7hcE3FvngtPosh+uF0mT2UcN/p0zjsVPlmnASEI3luBBDwnt7o0Ik5ML6RcN4fPfxvvVOlgKvXOPJV1VMcjnc53banQzGcfoDumSXiV3FBOb3tRogoPA+HAQ47yylEnE9yBFONU7qxYDkNbpSgdCNEnLpRKyY4YaZ66Y2NeqKjHhnpo0kJ9VGCHuv3qTi7oL7Jsb6oFX0x/5kKd6vBifYbTrzVHwV6Yq3crXKXylEcd6la8VYcR3GY3mgV59fXp1Nx7HNiHzGKkfgLQfHe2MpsYnIAAAAASUVORK5CYII="
                  loading="lazy"
                />
                <span class="text">黑胶VIP</span>
              </span>
              <span v-else class="text">{{ data.user.signature }}</span>
            </div>
          </div>
        </div>
        <div class="right">
          <button @click="logout">
            <svg-icon icon-class="logout" />
            {{ $t('settings.logout') }}
          </button>
        </div>
      </div>
      <div v-else class="user login-entry"
        ><button @click="toLogin">{{ $t('login.login') }}</button></div
      ><nav class="settings-tabs" role="tablist" aria-label="设置分类"
        ><button
          v-for="category in categories"
          :id="'settings-tab-' + category.key"
          :key="category.key"
          type="button"
          role="tab"
          :aria-selected="activeCategory === category.key"
          :aria-controls="'settings-panel-' + category.key"
          :tabindex="activeCategory === category.key ? 0 : -1"
          :class="{ active: activeCategory === category.key }"
          @click="activeCategory = category.key"
          @keydown="categoryKey($event, category.key)"
          ><strong>{{ category.title }}</strong
          ><span>{{ category.caption }}</span></button
        ></nav
      ><section
        v-show="activeCategory === 'playback'"
        v-page-reveal="activeCategory === 'playback'"
        id="settings-panel-playback"
        role="tabpanel"
        aria-labelledby="settings-tab-playback"
        tabindex="0"
        class="settings-panel"
        ><h3 class="panel-title">播放</h3
        ><div class="settings-cards"
          ><section class="settings-card"
            ><h4 class="card-heading">音源与输出</h4
            ><div class="item">
              <div class="left">
                <div class="title">
                  {{ $t('settings.musicQuality.text') }}
                </div>
              </div>
              <div class="right">
                <select v-model="musicQuality">
                  <option value="128000">
                    {{ $t('settings.musicQuality.low') }} - 128Kbps
                  </option>
                  <option value="192000">
                    {{ $t('settings.musicQuality.medium') }} - 192Kbps
                  </option>
                  <option value="320000">
                    {{ $t('settings.musicQuality.high') }} - 320Kbps
                  </option>
                  <option value="flac">
                    {{ $t('settings.musicQuality.lossless') }} - FLAC
                  </option>
                  <option value="999000">Hi-Res</option>
                </select>
              </div>
            </div>
            <div v-if="isElectron" class="item">
              <div class="left">
                <div class="title"> {{ $t('settings.deviceSelector') }} </div>
              </div>
              <div class="right">
                <select v-model="outputDevice">
                  <option
                    v-for="device in allOutputDevices"
                    :key="device.deviceId"
                    :value="device.deviceId"
                    :selected="device.deviceId == outputDevice"
                  >
                    {{ $t(device.label) }}
                  </option>
                </select>
              </div>
            </div>
            <div v-if="isAndroid" class="item">
              <div class="left">
                <div class="title">允许与其他应用同时播放</div>
                <div class="description">
                  开启后允许同时发声，关闭则恢复常规播放行为。
                </div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="allow-concurrent-playback"
                    v-model="allowConcurrentPlayback"
                    type="checkbox"
                    name="allow-concurrent-playback"
                    aria-label="允许与其他应用同时播放"
                  />
                  <label for="allow-concurrent-playback"></label>
                </div>
              </div> </div></section
          ><section class="settings-card"
            ><h4 class="card-heading">播放控制</h4
            ><PlayerButtonSettings /></section
          ><section class="settings-card" v-if="isAndroid"
            ><h4 class="card-heading">播放信息</h4
            ><div v-if="isAndroid" class="item android-current-quality">
              <div class="left">
                <div class="title">当前播放音质</div>
                <div class="description">所选音质在下次加载音源时生效。</div>
              </div>
              <div class="right">
                <div>{{ androidQualityInfo }}</div>
                <div class="description">{{ androidQualityNote }}</div>
              </div>
            </div></section
          ></div
        ></section
      >
      <section
        v-show="activeCategory === 'cache'"
        v-page-reveal="activeCategory === 'cache'"
        id="settings-panel-cache"
        role="tabpanel"
        aria-labelledby="settings-tab-cache"
        tabindex="0"
        class="settings-panel"
        ><h3 class="panel-title">缓存</h3
        ><div class="settings-cards"
          ><section v-if="isAndroid || isElectron" class="settings-card"
            ><h4 class="card-heading">存储管理</h4
            ><div v-if="isElectron || isAndroid" class="item">
              <div class="left">
                <div v-if="isAndroid" class="title"
                  >已使用 {{ tracksCache.size }}</div
                >
                <div v-else class="title">
                  {{
                    $t('settings.cacheCount', {
                      song: tracksCache.length,
                      size: tracksCache.size,
                    })
                  }}</div
                >
                <div v-if="isAndroid" class="description">
                  完整音源 {{ tracksCache.length }} 项，部分缓存
                  {{ tracksCache.partial }} 项。
                </div>
              </div>
              <div class="right">
                <button :disabled="cacheClearing" @click="clearCache()">
                  {{
                    cacheClearing ? '正在清除…' : $t('settings.clearSongsCache')
                  }}
                </button>
              </div>
            </div>
            <div v-if="isAndroid" class="item">
              <div class="left">
                <div class="title"
                  >歌单图片缓存：{{ artworkCache.count }} 张 ·
                  {{ artworkCache.size }}</div
                >
                <div class="description"
                  >保存音乐库及已打开歌单的图片，按需缓存，不遍历下载歌曲封面。<details
                    ><summary>本次缓存统计</summary>本地命中
                    {{ artworkCache.hits || 0 }} 次，下载
                    {{ artworkCache.downloads || 0 }} 次，失败
                    {{ artworkCache.failures || 0 }} 次。</details
                  ></div
                >
              </div>
              <div class="right">
                <button :disabled="artworkClearing" @click="clearArtworkCache">
                  {{ artworkClearing ? '正在清除…' : '清除图片缓存' }}
                </button>
              </div>
            </div></section
          ><section class="settings-card" v-if="isAndroid || isElectron"
            ><h4 class="card-heading">自动缓存</h4
            ><div v-if="isElectron || isAndroid" class="item">
              <div class="left">
                <div class="title">
                  {{ $t('settings.automaticallyCacheSongs') }}
                </div>
                <div v-if="isAndroid" class="description">
                  播放时自动保存歌曲片段。关闭后保留已有缓存。
                </div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="automatically-cache-songs"
                    v-model="automaticallyCacheSongs"
                    type="checkbox"
                    name="automatically-cache-songs"
                  />
                  <label for="automatically-cache-songs"></label>
                </div>
              </div>
            </div>
            <div v-if="isElectron || isAndroid" class="item">
              <div class="left">
                <div class="title"> {{ $t('settings.cacheLimit.text') }} </div>
              </div>
              <div class="right">
                <select v-model="cacheLimit">
                  <option :value="false">
                    {{ $t('settings.cacheLimit.none') }}
                  </option>
                  <option :value="512"> 512MB </option>
                  <option :value="1024"> 1GB </option>
                  <option :value="2048"> 2GB </option>
                  <option :value="4096"> 4GB </option>
                  <option :value="8192"> 8GB </option>
                </select>
              </div>
            </div></section
          ><section class="settings-card"
            ><h4 class="card-heading">保留与纪念</h4
            ><div class="item">
              <div class="left"
                ><div class="title">纪念模式</div>
                <div class="description"
                  >停止接口更新，只浏览已保存的内容。保留条目、图片与歌曲缓存，暂停自动淘汰；只有已缓存的音频可以离线播放。</div
                ></div
              >
              <div class="right"
                ><div class="toggle"
                  ><input
                    id="archive-mode"
                    v-model="archiveMode"
                    type="checkbox" /><label for="archive-mode"></label></div
              ></div> </div></section></div
      ></section>
      <section
        v-show="activeCategory === 'appearance'"
        v-page-reveal="activeCategory === 'appearance'"
        id="settings-panel-appearance"
        role="tabpanel"
        aria-labelledby="settings-tab-appearance"
        tabindex="0"
        class="settings-panel"
        ><h3 class="panel-title">外观</h3
        ><div class="settings-cards"
          ><section class="settings-card"
            ><h4 class="card-heading">主题与语言</h4
            ><div class="item">
              <div class="left">
                <div class="title"> {{ $t('settings.appearance.text') }} </div>
              </div>
              <div class="right">
                <select v-model="appearance">
                  <option value="auto">{{
                    $t('settings.appearance.auto')
                  }}</option>
                  <option value="light"
                    >🌞 {{ $t('settings.appearance.light') }}</option
                  >
                  <option value="dark"
                    >🌚 {{ $t('settings.appearance.dark') }}</option
                  >
                </select>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title"> {{ $t('settings.themeColor.text') }} </div>
              </div>
              <div class="right">
                <select v-model="themeColor">
                  <option value="default">
                    {{ $t('settings.themeColor.default') }}
                  </option>
                  <option value="sunset">
                    {{ $t('settings.themeColor.sunset') }}
                  </option>
                  <option value="ocean">
                    {{ $t('settings.themeColor.ocean') }}
                  </option>
                  <option value="forest">
                    {{ $t('settings.themeColor.forest') }}
                  </option>
                </select>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title"> {{ $t('settings.language') }} </div>
              </div>
              <div class="right">
                <select v-model="lang">
                  <option value="en">English</option>
                  <option value="tr">Türkçe</option>
                  <option value="zh-CN">简体中文</option>
                  <option value="zh-TW">繁體中文</option>
                </select>
              </div>
            </div></section
          >
          <section class="settings-card"
            ><h4 class="card-heading">界面</h4
            ><div v-if="isAndroid" class="item"
              ><div class="left"
                ><div class="title">显示系统时间栏</div
                ><div class="description"
                  >控制顶部系统时间、电量等状态信息。</div
                ></div
              ><div class="right"
                ><div class="toggle"
                  ><input
                    id="system-status-bar"
                    v-model="showSystemStatusBar"
                    type="checkbox" /><label
                    for="system-status-bar"
                  ></label></div></div
            ></div>
            <div class="item"
              ><div class="left"
                ><div class="title">悬浮播放栏</div
                ><div class="description">关闭后播放栏贴合屏幕底部。</div></div
              ><div class="right"
                ><div class="toggle"
                  ><input
                    id="floatingPlayer"
                    v-model="floatingPlayer"
                    type="checkbox" /><label
                    for="floatingPlayer"
                  ></label></div></div
            ></div>
            <div class="item"
              ><div class="left"><div class="title">显示播放量</div></div
              ><div class="right"
                ><div class="toggle"
                  ><input
                    id="showPlayCounts"
                    v-model="showPlayCounts"
                    type="checkbox" /><label
                    for="showPlayCounts"
                  ></label></div></div
            ></div>
            <div class="item"
              ><div class="left"><div class="title">显示封面播放按钮</div></div
              ><div class="right"
                ><div class="toggle"
                  ><input
                    id="showCoverPlayButton"
                    v-model="showCoverPlayButton"
                    type="checkbox" /><label
                    for="showCoverPlayButton"
                  ></label></div></div
            ></div>
            <div class="item">
              <div class="left">
                <div class="title">显示歌曲副标题</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="sub-title-default"
                    v-model="subTitleDefault"
                    type="checkbox"
                    name="sub-title-default"
                  />
                  <label for="sub-title-default"></label>
                </div>
              </div> </div
          ></section>
          <section class="settings-card"
            ><h4 class="card-heading">歌词</h4
            ><div class="item">
              <div class="left">
                <div class="title">
                  {{ $t('settings.lyricFontSize.text') }}
                </div>
              </div>
              <div class="right">
                <select v-model="lyricFontSize">
                  <option value="16">
                    {{ $t('settings.lyricFontSize.small') }} - 16px
                  </option>
                  <option value="22">
                    {{ $t('settings.lyricFontSize.medium') }} - 22px
                  </option>
                  <option value="28">
                    {{ $t('settings.lyricFontSize.large') }} - 28px
                  </option>
                  <option value="36">
                    {{ $t('settings.lyricFontSize.xlarge') }} - 36px
                  </option>
                </select>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{
                  $t('settings.showLyricsTranslation')
                }}</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="show-lyrics-translation"
                    v-model="showLyricsTranslation"
                    type="checkbox"
                    name="show-lyrics-translation"
                  />
                  <label for="show-lyrics-translation"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">{{
                  $t('settings.lyricsBackground.text')
                }}</div>
              </div>
              <div class="right">
                <select v-model="lyricsBackground">
                  <option :value="false">
                    {{ $t('settings.lyricsBackground.off') }}
                  </option>
                  <option :value="true">
                    {{ $t('settings.lyricsBackground.on') }}
                  </option>
                  <option value="blur"> 模糊封面 </option>
                  <option value="dynamic">
                    {{ $t('settings.lyricsBackground.dynamic') }}
                  </option>
                </select>
              </div>
            </div></section
          >
          <section class="settings-card"
            ><h4 class="card-heading">首页内容</h4
            ><HomeSectionSettings /></section></div
      ></section>
      <section
        v-show="activeCategory === 'other'"
        v-page-reveal="activeCategory === 'other'"
        id="settings-panel-other"
        role="tabpanel"
        aria-labelledby="settings-tab-other"
        tabindex="0"
        class="settings-panel"
        ><h3 class="panel-title">其它</h3
        ><div class="settings-cards"
          ><section class="settings-card" v-if="isAndroid"
            ><h4 class="card-heading">系统播控</h4
            ><div v-if="isAndroid" class="item media-diagnostic"
              ><div class="left"
                ><div class="title">系统播控诊断</div
                ><div class="description">播控异常时复制此信息排查。</div></div
              ><div class="right"
                ><button @click="copyMediaDiagnostic">复制诊断</button></div
              ><textarea
                v-if="mediaDiagnostic"
                ref="mediaDiagnostic"
                :value="mediaDiagnostic"
                readonly
                aria-label="系统播控诊断"
              ></textarea></div></section
          ><section class="settings-card"
            ><h4 class="card-heading">应用连接</h4
            ><div class="item">
              <div class="left">
                <div class="title">
                  {{
                    isLastfmConnected
                      ? `已连接到 Last.fm (${lastfm.name})`
                      : '连接 Last.fm '
                  }}</div
                >
              </div>
              <div class="right">
                <button v-if="isLastfmConnected" @click="lastfmDisconnect()"
                  >断开连接
                </button>
                <button v-else @click="lastfmConnect()"> 授权连接 </button>
              </div>
            </div>
            <div v-if="isElectron" class="item">
              <div class="left">
                <div class="title">
                  {{ $t('settings.enableDiscordRichPresence') }}</div
                >
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="enable-discord-rich-presence"
                    v-model="enableDiscordRichPresence"
                    type="checkbox"
                    name="enable-discord-rich-presence"
                  />
                  <label for="enable-discord-rich-presence"></label>
                </div>
              </div>
            </div>
            <div v-if="isElectron && isLinux" class="item">
              <div class="left">
                <div class="title">
                  {{ $t('settings.unm.enable') }}
                  <a
                    target="_blank"
                    href="https://github.com/osdlyrics/osdlyrics"
                    >OSDLyrics</a
                  >
                  {{ $t('settings.enableOsdlyricsSupport.title') }}
                </div>
                <div class="description">
                  {{ $t('settings.enableOsdlyricsSupport.desc1') }}
                  <br />
                  {{ $t('settings.enableOsdlyricsSupport.desc2') }}
                </div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="enable-osdlyrics-support"
                    v-model="enableOsdlyricsSupport"
                    type="checkbox"
                    name="enable-osdlyrics-support"
                  />
                  <label for="enable-osdlyrics-support"></label>
                </div>
              </div> </div></section
          ><section class="settings-card"
            ><h4 class="card-heading">使用偏好</h4
            ><div v-if="isElectron" class="item">
              <div class="left">
                <div class="title">
                  {{ $t('settings.showLibraryDefault') }}</div
                >
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="show-library-default"
                    v-model="showLibraryDefault"
                    type="checkbox"
                    name="show-library-default"
                  />
                  <label for="show-library-default"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">倒序播放按钮</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="enable-reversed-mode"
                    v-model="enableReversedMode"
                    type="checkbox"
                    name="enable-reversed-mode"
                  />
                  <label for="enable-reversed-mode"></label>
                </div>
              </div>
            </div>
            <div class="item">
              <div class="left">
                <div class="title">彩虹猫进度条</div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="nyancat-style"
                    v-model="nyancatStyle"
                    type="checkbox"
                    name="nyancat-style"
                  />
                  <label for="nyancat-style"></label>
                </div>
              </div> </div></section
          ><section class="settings-card" v-if="isElectron"
            ><h4 class="card-heading">桌面与快捷键</h4
            ><div v-if="isElectron" class="item">
              <div class="left">
                <div class="title"> {{ $t('settings.trayIcon.text') }} </div>
              </div>
              <div class="right">
                <select v-model="trayIconTheme">
                  <option value="auto">{{
                    $t('settings.trayIcon.auto')
                  }}</option>
                  <option value="light">{{
                    $t('settings.trayIcon.light')
                  }}</option>
                  <option value="dark">{{
                    $t('settings.trayIcon.dark')
                  }}</option>
                </select>
              </div>
            </div>
            <div v-if="isElectron && !isMac" class="item">
              <div class="left">
                <div class="title">
                  {{ $t('settings.closeAppOption.text') }}
                </div>
              </div>
              <div class="right">
                <select v-model="closeAppOption">
                  <option value="ask">
                    {{ $t('settings.closeAppOption.ask') }}
                  </option>
                  <option value="exit">
                    {{ $t('settings.closeAppOption.exit') }}
                  </option>
                  <option value="minimizeToTray">
                    {{ $t('settings.closeAppOption.minimizeToTray') }}
                  </option>
                </select>
              </div>
            </div>
            <div v-if="isElectron && isLinux" class="item">
              <div class="left">
                <div class="title">
                  {{ $t('settings.enableCustomTitlebar') }}
                </div>
              </div>
              <div class="right">
                <div class="toggle">
                  <input
                    id="enable-custom-titlebar"
                    v-model="enableCustomTitlebar"
                    type="checkbox"
                    name="enable-custom-titlebar"
                  />
                  <label for="enable-custom-titlebar"></label>
                </div>
              </div>
            </div>
            <div v-if="isElectron">
              <h4>快捷键</h4>
              <div class="item">
                <div class="left">
                  <div class="title">
                    {{ $t('settings.enableGlobalShortcut') }}</div
                  >
                </div>
                <div class="right">
                  <div class="toggle">
                    <input
                      id="enable-enable-global-shortcut"
                      v-model="enableGlobalShortcut"
                      type="checkbox"
                      name="enable-enable-global-shortcut"
                    />
                    <label for="enable-enable-global-shortcut"></label>
                  </div>
                </div>
              </div>
              <div
                id="shortcut-table"
                :class="{ 'global-disabled': !enableGlobalShortcut }"
                tabindex="0"
                @keydown="handleShortcutKeydown"
              >
                <div class="row row-head">
                  <div class="col">功能</div>
                  <div class="col">快捷键</div>
                  <div class="col">全局快捷键</div>
                </div>
                <div
                  v-for="shortcut in settings.shortcuts"
                  :key="shortcut.id"
                  class="row"
                >
                  <div class="col">{{ shortcut.name }}</div>
                  <div class="col">
                    <div
                      class="keyboard-input"
                      :class="{
                        active:
                          shortcutInput.id === shortcut.id &&
                          shortcutInput.type === 'shortcut',
                      }"
                      @click.stop="
                        readyToRecordShortcut(shortcut.id, 'shortcut')
                      "
                    >
                      {{
                        shortcutInput.id === shortcut.id &&
                        shortcutInput.type === 'shortcut' &&
                        recordedShortcutComputed !== ''
                          ? formatShortcut(recordedShortcutComputed)
                          : formatShortcut(shortcut.shortcut)
                      }}
                    </div>
                  </div>
                  <div class="col">
                    <div
                      class="keyboard-input"
                      :class="{
                        active:
                          shortcutInput.id === shortcut.id &&
                          shortcutInput.type === 'globalShortcut' &&
                          enableGlobalShortcut,
                      }"
                      @click.stop="
                        readyToRecordShortcut(shortcut.id, 'globalShortcut')
                      "
                      >{{
                        shortcutInput.id === shortcut.id &&
                        shortcutInput.type === 'globalShortcut' &&
                        recordedShortcutComputed !== ''
                          ? formatShortcut(recordedShortcutComputed)
                          : formatShortcut(shortcut.globalShortcut)
                      }}</div
                    >
                  </div>
                </div>
                <button
                  class="restore-default-shortcut"
                  @click="restoreDefaultShortcuts"
                  >恢复默认快捷键</button
                >
              </div>
            </div></section
          ><section class="settings-card"
            ><h4 class="card-heading">自定义样式</h4
            ><div class="item custom-css-item">
              <div class="left">
                <div class="title">{{ $t('settings.customCss.text') }}</div>
                <div class="description">{{
                  $t('settings.customCss.description')
                }}</div>
              </div>
              <form
                class="right custom-css-form"
                @submit.prevent="saveCustomCss"
              >
                <input
                  v-model="customCssInput"
                  class="text-input"
                  type="text"
                  spellcheck="false"
                  :aria-label="$t('settings.customCss.text')"
                  :placeholder="$t('settings.customCss.placeholder')"
                  :disabled="customCssLoading"
                />
                <div class="custom-css-actions">
                  <button
                    v-if="isElectron"
                    type="button"
                    :disabled="customCssLoading"
                    @click="chooseCustomCss"
                  >
                    {{ $t('settings.customCss.chooseFile') }}
                  </button>
                  <button type="submit" :disabled="customCssLoading">
                    {{ $t('settings.customCss.apply') }}
                  </button>
                  <button
                    type="button"
                    :disabled="customCssLoading || !settings.customCssUrl"
                    @click="reloadCustomCss"
                  >
                    {{ $t('settings.customCss.reload') }}
                  </button>
                  <button
                    type="button"
                    :disabled="customCssLoading"
                    @click="clearCustomCss"
                  >
                    {{ $t('settings.customCss.clear') }}
                  </button>
                </div>
              </form>
            </div></section
          ><section class="settings-card" v-if="isAndroid"
            ><h4 class="card-heading">音乐接口</h4
            ><div v-if="isAndroid" class="item android-api-address">
              <div class="left">
                <div class="title">音乐接口地址</div>
              </div>
              <form class="right" @submit.prevent="saveAndroidApi">
                <input
                  v-model="androidApiInput"
                  class="text-input"
                  type="url"
                  :aria-label="$t('settings.androidApi.text')"
                  :placeholder="$t('settings.androidApi.placeholder')"
                />
                <button type="submit">{{
                  $t('settings.androidApi.save')
                }}</button>
              </form>
            </div></section
          ><section class="settings-card" v-if="isElectron"
            ><h4 class="card-heading">高级网络配置</h4
            ><section v-if="isElectron" class="unm-configuration">
              <h4>UnblockNeteaseMusic</h4>
              <div class="item">
                <div class="left">
                  <div class="title"
                    >{{ $t('settings.unm.enable') }}
                    <a
                      href="https://github.com/UnblockNeteaseMusic/server"
                      target="blank"
                      >UnblockNeteaseMusic</a
                    ></div
                  >
                </div>
                <div class="right">
                  <div class="toggle">
                    <input
                      id="enable-unblock-netease-music"
                      v-model="enableUnblockNeteaseMusic"
                      type="checkbox"
                      name="enable-unblock-netease-music"
                    />
                    <label for="enable-unblock-netease-music"></label>
                  </div>
                </div>
              </div>

              <div class="item">
                <div class="left">
                  <div class="title">
                    {{ $t('settings.unm.audioSource.title') }}
                  </div>
                  <div class="description">
                    音源的具体代号
                    <a
                      href="https://github.com/UnblockNeteaseMusic/server-rust/blob/main/README.md#支援的所有引擎"
                      target="_blank"
                    >
                      可以点此到 UNM 的说明页面查询。 </a
                    ><br />
                    多个音源请用 <code>,</code> 逗号分隔。<br />
                    留空则使用 UNM 内置的默认值。
                  </div>
                </div>
                <div class="right">
                  <input
                    v-model="unmSource"
                    class="text-input margin-right-0"
                    placeholder="例 bilibili, kuwo"
                  />
                </div>
              </div>

              <div class="item">
                <div class="left">
                  <div class="title">
                    {{ $t('settings.unm.enableFlac.title') }}
                  </div>
                  <div class="description">
                    {{ $t('settings.unm.enableFlac.desc') }}
                  </div>
                </div>
                <div class="right">
                  <div class="toggle">
                    <input
                      id="unm-enable-flac"
                      v-model="unmEnableFlac"
                      type="checkbox"
                    />
                    <label for="unm-enable-flac" />
                  </div>
                </div>
              </div>

              <div class="item">
                <div class="left">
                  <div class="title">
                    {{ $t('settings.unm.searchMode.title') }}
                  </div>
                </div>
                <div class="right">
                  <select v-model="unmSearchMode">
                    <option value="fast-first">
                      {{ $t('settings.unm.searchMode.fast') }}
                    </option>
                    <option value="order-first">
                      {{ $t('settings.unm.searchMode.order') }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="item">
                <div class="left">
                  <div class="title">{{ $t('settings.unm.cookie.joox') }}</div>
                  <div class="description">
                    <a
                      href="https://github.com/UnblockNeteaseMusic/server-rust/tree/main/engines#joox-cookie-設定說明"
                      target="_blank"
                      >{{ $t('settings.unm.cookie.desc1') }}
                    </a>
                    {{ $t('settings.unm.cookie.desc2') }}
                  </div>
                </div>
                <div class="right">
                  <input
                    v-model="unmJooxCookie"
                    class="text-input margin-right-0"
                    placeholder="wmid=..; session_key=.."
                  />
                </div>
              </div>

              <div class="item">
                <div class="left">
                  <div class="title"> {{ $t('settings.unm.cookie.qq') }} </div>
                  <div class="description">
                    <a
                      href="https://github.com/UnblockNeteaseMusic/server-rust/tree/main/engines#qq-cookie-設定說明"
                      target="_blank"
                      >{{ $t('settings.unm.cookie.desc1') }}
                    </a>
                    {{ $t('settings.unm.cookie.desc2') }}
                  </div>
                </div>
                <div class="right">
                  <input
                    v-model="unmQQCookie"
                    class="text-input margin-right-0"
                    placeholder="uin=..; qm_keyst=..;"
                  />
                </div>
              </div>

              <div class="item">
                <div class="left">
                  <div class="title"> {{ $t('settings.unm.ytdl') }} </div>
                  <div class="description">
                    <a
                      href="https://github.com/UnblockNeteaseMusic/server-rust/tree/main/engines#ytdlexe-設定說明"
                      target="_blank"
                      >{{ $t('settings.unm.cookie.desc1') }}
                    </a>
                    {{ $t('settings.unm.cookie.desc2') }}
                  </div>
                </div>
                <div class="right">
                  <input
                    v-model="unmYtDlExe"
                    class="text-input margin-right-0"
                    placeholder="ex. youtube-dl"
                  />
                </div>
              </div>

              <div class="item">
                <div class="left">
                  <div class="title">
                    {{ $t('settings.unm.proxy.title') }}
                  </div>
                  <div class="description">
                    {{ $t('settings.unm.proxy.desc1') }}<br />
                    {{ $t('settings.unm.proxy.desc2') }}
                  </div>
                </div>
                <div class="right">
                  <input
                    v-model="unmProxyUri"
                    class="text-input margin-right-0"
                    placeholder="ex. https://192.168.11.45"
                  />
                </div>
              </div>
            </section>
            <div v-if="isElectron">
              <h4>代理</h4>
              <div class="item">
                <div class="left">
                  <div class="title"> 代理协议 </div>
                </div>
                <div class="right">
                  <select v-model="proxyProtocol">
                    <option value="noProxy"> 关闭代理 </option>
                    <option value="HTTP"> HTTP 代理 </option>
                    <option value="HTTPS"> HTTPS 代理 </option>
                    <!-- <option value="SOCKS"> SOCKS 代理 </option> -->
                  </select>
                </div>
              </div>
              <div
                id="proxy-form"
                :class="{ disabled: proxyProtocol === 'noProxy' }"
              >
                <input
                  v-model="proxyServer"
                  class="text-input"
                  placeholder="服务器地址"
                  :disabled="proxyProtocol === 'noProxy'"
                /><input
                  v-model="proxyPort"
                  class="text-input"
                  placeholder="端口"
                  type="number"
                  min="1"
                  max="65535"
                  :disabled="proxyProtocol === 'noProxy'"
                />
                <button @click="sendProxyConfig">更新代理</button>
              </div>
            </div>
            <div v-if="isElectron">
              <h4>请求出口 IP</h4>
              <div class="item">
                <div class="left">
                  <div class="title">自定义请求出口 IP</div>
                </div>
                <div class="right">
                  <div class="toggle">
                    <input
                      id="enable-real-ip"
                      v-model="enableRealIP"
                      type="checkbox"
                      name="enable-real-ip"
                    />
                    <label for="enable-real-ip"></label>
                  </div>
                </div>
              </div>
              <div id="real-ip" :class="{ disabled: !enableRealIP }">
                <input
                  v-model="realIP"
                  class="text-input"
                  placeholder="IP地址"
                  :disabled="!enableRealIP"
                />
              </div> </div></section></div></section
      ><div class="footer">
        <p class="author"
          >MADE BY
          <a
            href="https://github.com/qier222"
            target="_blank"
            rel="noopener noreferrer"
            >QIER222</a
          ></p
        >
        <p class="author"
          >本构建由
          <a
            href="https://kuanzzz.pages.dev"
            target="_blank"
            rel="noopener noreferrer"
            >kuanzzz.pages.dev</a
          >
          修改；原软件归原作者所有，修改内容遵循项目原有开源许可。
        </p>
        <p class="repository-links">
          <a
            href="https://github.com/qier222/YesPlayMusic"
            target="_blank"
            rel="noopener noreferrer"
            >主软件仓库</a
          >
          <span> · </span>
          <a
            href="https://github.com/461c/YesPlayMusic"
            target="_blank"
            rel="noopener noreferrer"
            >本构建仓库</a
          >
        </p>
        <p class="version">v{{ version }}</p>
      </div></div
    ></div
  >
</template>

<script>
import { mapState, mapActions } from 'vuex';
import { isLooseLoggedIn, doLogout } from '@/utils/auth';
import { auth as lastfmAuth } from '@/api/lastfm';
import {
  changeAppearance,
  changeThemeColor,
  bytesToSize,
} from '@/utils/common';
import { countDBSize, clearDB } from '@/utils/db';
import { applyCustomCss } from '@/utils/customCss';
import { isAndroid } from '@/utils/androidAudio';
import pkg from '../../package.json';
import HomeSectionSettings from '@/components/HomeSectionSettings.vue';
import PlayerButtonSettings from '@/components/PlayerButtonSettings.vue';

const electron =
  process.env.IS_ELECTRON === true ? window.require('electron') : null;
const ipcRenderer =
  process.env.IS_ELECTRON === true ? electron.ipcRenderer : null;

const validShortcutCodes = ['=', '-', '~', '[', ']', ';', "'", ',', '.', '/'];

export default {
  name: 'Settings',
  components: { HomeSectionSettings, PlayerButtonSettings },
  data() {
    return {
      activeCategory:
        this.$route.hash === '#home-sections' ? 'appearance' : 'playback',
      categories: [
        { key: 'playback', title: '播放', caption: '音质与控制' },
        { key: 'cache', title: '缓存', caption: '歌曲与图片' },
        { key: 'appearance', title: '外观', caption: '主题与界面' },
        { key: 'other', title: '其它', caption: '连接与高级' },
      ],
      mediaDiagnostic: '',
      androidApiInput: isAndroid ? window.YesPlayMusicAndroid.getApiUrl() : '',
      customCssInput: this.$store.state.settings.customCssUrl || '',
      customCssLoading: false,
      tracksCache: {
        size: '0KB',
        length: 0,
        partial: 0,
      },
      artworkCache: { size: '0KB', count: 0, pending: 0 },
      artworkClearing: false,
      cacheStatsTimer: null,
      cacheClearing: false,
      allOutputDevices: [
        {
          deviceId: 'default',
          label: 'settings.permissionRequired',
        },
      ],
      shortcutInput: {
        id: '',
        type: '',
        recording: false,
      },
      recordedShortcut: [],
    };
  },
  computed: {
    showSystemStatusBar: {
      get() {
        return this.settings.showSystemStatusBar !== false;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'showSystemStatusBar',
          value,
        });
      },
    },
    archiveMode: {
      get() {
        return this.settings.archiveMode === true;
      },
      set(value) {
        this.$store.commit('updateSettings', { key: 'archiveMode', value });
      },
    },
    floatingPlayer: {
      get() {
        return this.settings.floatingPlayer !== false;
      },
      set(value) {
        this.$store.commit('updateSettings', { key: 'floatingPlayer', value });
      },
    },
    showPlayCounts: {
      get() {
        return this.settings.showPlayCounts !== false;
      },
      set(value) {
        this.$store.commit('updateSettings', { key: 'showPlayCounts', value });
      },
    },
    showCoverPlayButton: {
      get() {
        return this.settings.showCoverPlayButton !== false;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'showCoverPlayButton',
          value,
        });
      },
    },
    ...mapState(['player', 'settings', 'data', 'lastfm', 'androidAudioInfo']),
    androidQualityInfo() {
      const info = this.androidAudioInfo;
      if (!info)
        return this.player.playing ? '正在读取当前音源信息…' : '暂无播放信息';
      const formats = {
        'audio/mpeg': 'MP3',
        'audio/flac': 'FLAC',
        'audio/mp4a-latm': 'AAC',
        'audio/opus': 'Opus',
        'audio/raw': 'PCM',
      };
      const parts = [
        formats[info.mime] || info.sourceFormat?.toUpperCase() || '格式未知',
      ];
      if (info.bitrate > 0)
        parts.push(`${Math.round(info.bitrate / 1000)} kbps`);
      if (info.sampleRate > 0) parts.push(`${info.sampleRate / 1000} kHz`);
      if (info.bitDepth > 0) parts.push(`${info.bitDepth}-bit`);
      if (info.channels > 0) parts.push(`${info.channels} 声道`);
      return parts.join(' · ');
    },
    androidQualityNote() {
      const info = this.androidAudioInfo;
      if (!info) return '';
      if (info.guest) return '未登录，当前使用公开音源。';
      const levels = {
        standard: '标准',
        higher: '较高',
        exhigh: '极高',
        lossless: '无损',
        hires: 'Hi-Res',
      };
      const requested = levels[info.requestedLevel];
      const actual = levels[info.sourceLevel];
      const parts = [];
      if (requested) parts.push(`请求档位：${requested}`);
      if (actual) parts.push(`音源档位：${actual}`);
      return parts.join(' · ');
    },
    isAndroid() {
      return isAndroid;
    },
    isElectron() {
      return process.env.IS_ELECTRON;
    },
    isMac() {
      return /macintosh|mac os x/i.test(navigator.userAgent);
    },
    isLinux() {
      return process.platform === 'linux';
    },
    version() {
      return pkg.version;
    },
    showUserInfo() {
      return isLooseLoggedIn() && this.data.user.nickname;
    },
    recordedShortcutComputed() {
      let shortcut = [];
      this.recordedShortcut.map(e => {
        if (e.keyCode >= 65 && e.keyCode <= 90) {
          // A-Z
          shortcut.push(e.code.replace('Key', ''));
        } else if (e.key === 'Meta') {
          // ⌘ Command on macOS
          shortcut.push('Command');
        } else if (['Alt', 'Control', 'Shift'].includes(e.key)) {
          shortcut.push(e.key);
        } else if (e.keyCode >= 48 && e.keyCode <= 57) {
          // 0-9
          shortcut.push(e.code.replace('Digit', ''));
        } else if (e.keyCode >= 112 && e.keyCode <= 123) {
          // F1-F12
          shortcut.push(e.code);
        } else if (
          ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)
        ) {
          // Arrows
          shortcut.push(e.code.replace('Arrow', ''));
        } else if (validShortcutCodes.includes(e.key)) {
          shortcut.push(e.key);
        }
      });
      const sortTable = {
        Control: 1,
        Shift: 2,
        Alt: 3,
        Command: 4,
      };
      shortcut = shortcut.sort((a, b) => {
        if (!sortTable[a] || !sortTable[b]) return 0;
        if (sortTable[a] - sortTable[b] <= -1) {
          return -1;
        } else if (sortTable[a] - sortTable[b] >= 1) {
          return 1;
        } else {
          return 0;
        }
      });
      shortcut = shortcut.join('+');
      return shortcut;
    },

    lang: {
      get() {
        return this.settings.lang;
      },
      set(lang) {
        this.$i18n.locale = lang;
        this.$store.commit('changeLang', lang);
      },
    },
    musicLanguage: {
      get() {
        return this.settings.musicLanguage ?? 'all';
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'musicLanguage',
          value,
        });
      },
    },
    appearance: {
      get() {
        if (this.settings.appearance === undefined) return 'auto';
        return this.settings.appearance;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'appearance',
          value,
        });
        changeAppearance(value);
        const resolvedAppearance =
          value === 'auto'
            ? document.body?.getAttribute('data-theme') || 'light'
            : value;
        changeThemeColor(this.themeColor, resolvedAppearance);
      },
    },
    themeColor: {
      get() {
        if (this.settings.themeColor === undefined) return 'default';
        return this.settings.themeColor;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'themeColor',
          value,
        });
        const resolvedAppearance =
          this.settings.appearance === 'auto'
            ? document.body?.getAttribute('data-theme') || 'light'
            : this.settings.appearance;
        changeThemeColor(value, resolvedAppearance);
      },
    },
    trayIconTheme: {
      get() {
        if (this.settings.trayIconTheme === undefined) return 'auto';
        return this.settings.trayIconTheme;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'trayIconTheme',
          value,
        });
        if (this.isElectron) {
          ipcRenderer.send('updateTrayIcon', value);
        }
      },
    },
    musicQuality: {
      get() {
        return this.settings.musicQuality ?? 320000;
      },
      set(value) {
        if (value === this.settings.musicQuality) return;
        this.$store.commit('changeMusicQuality', value);
        if (!this.isAndroid) this.clearCache();
      },
    },
    allowConcurrentPlayback: {
      get() {
        return this.settings.allowConcurrentPlayback ?? false;
      },
      set(value) {
        this.$store.commit('changeConcurrentPlayback', value);
      },
    },
    lyricFontSize: {
      get() {
        if (this.settings.lyricFontSize === undefined) return 28;
        return this.settings.lyricFontSize;
      },
      set(value) {
        this.$store.commit('changeLyricFontSize', value);
      },
    },
    outputDevice: {
      get() {
        const isValidDevice = this.allOutputDevices.find(
          device => device.deviceId === this.settings.outputDevice
        );
        if (
          this.settings.outputDevice === undefined ||
          isValidDevice === undefined
        )
          return 'default'; // Default deviceId
        return this.settings.outputDevice;
      },
      set(deviceId) {
        if (deviceId === this.settings.outputDevice || deviceId === undefined)
          return;
        this.$store.commit('changeOutputDevice', deviceId);
        this.player.setOutputDevice();
      },
    },
    enableUnblockNeteaseMusic: {
      get() {
        const value = this.settings.enableUnblockNeteaseMusic;
        return value !== undefined ? value : true;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'enableUnblockNeteaseMusic',
          value,
        });
      },
    },
    showPlaylistsByAppleMusic: {
      get() {
        if (this.settings.showPlaylistsByAppleMusic === undefined) return true;
        return this.settings.showPlaylistsByAppleMusic;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'showPlaylistsByAppleMusic',
          value,
        });
      },
    },
    nyancatStyle: {
      get() {
        if (this.settings.nyancatStyle === undefined) return false;
        return this.settings.nyancatStyle;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'nyancatStyle',
          value,
        });
      },
    },
    automaticallyCacheSongs: {
      get() {
        if (this.settings.automaticallyCacheSongs === undefined) return false;
        return this.settings.automaticallyCacheSongs;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'automaticallyCacheSongs',
          value,
        });
        if (value === false && !this.isAndroid) {
          this.clearCache();
        }
      },
    },
    showLyricsTranslation: {
      get() {
        return this.settings.showLyricsTranslation;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'showLyricsTranslation',
          value,
        });
      },
    },
    lyricsBackground: {
      get() {
        return this.settings.lyricsBackground || false;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'lyricsBackground',
          value,
        });
      },
    },
    enableOsdlyricsSupport: {
      get() {
        return this.settings.enableOsdlyricsSupport;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'enableOsdlyricsSupport',
          value,
        });
      },
    },
    closeAppOption: {
      get() {
        return this.settings.closeAppOption;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'closeAppOption',
          value,
        });
      },
    },
    enableDiscordRichPresence: {
      get() {
        return this.settings.enableDiscordRichPresence;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'enableDiscordRichPresence',
          value,
        });
      },
    },
    subTitleDefault: {
      get() {
        return this.settings.subTitleDefault;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'subTitleDefault',
          value,
        });
      },
    },
    enableReversedMode: {
      get() {
        if (this.settings.enableReversedMode === undefined) return false;
        return this.settings.enableReversedMode;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'enableReversedMode',
          value,
        });
        if (value === false) {
          this.$store.state.player.reversed = false;
        }
      },
    },
    enableGlobalShortcut: {
      get() {
        return this.settings.enableGlobalShortcut;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'enableGlobalShortcut',
          value,
        });
      },
    },
    showLibraryDefault: {
      get() {
        return this.settings.showLibraryDefault || false;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'showLibraryDefault',
          value,
        });
      },
    },
    cacheLimit: {
      get() {
        return this.settings.cacheLimit || false;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'cacheLimit',
          value,
        });
      },
    },
    proxyProtocol: {
      get() {
        return this.settings.proxyConfig?.protocol || 'noProxy';
      },
      set(value) {
        let config = this.settings.proxyConfig || {};
        config.protocol = value;
        if (value === 'noProxy') {
          ipcRenderer.send('removeProxy');
          this.showToast('已关闭代理');
        }
        this.$store.commit('updateSettings', {
          key: 'proxyConfig',
          value: config,
        });
      },
    },
    proxyServer: {
      get() {
        return this.settings.proxyConfig?.server || '';
      },
      set(value) {
        let config = this.settings.proxyConfig || {};
        config.server = value;
        this.$store.commit('updateSettings', {
          key: 'proxyConfig',
          value: config,
        });
      },
    },
    enableRealIP: {
      get() {
        return this.settings.enableRealIP || false;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'enableRealIP',
          value: value,
        });
      },
    },
    realIP: {
      get() {
        return this.settings.realIP || '';
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'realIP',
          value: value,
        });
      },
    },
    proxyPort: {
      get() {
        return this.settings.proxyConfig?.port || '';
      },
      set(value) {
        let config = this.settings.proxyConfig || {};
        config.port = value;
        this.$store.commit('updateSettings', {
          key: 'proxyConfig',
          value: config,
        });
      },
    },
    unmSource: {
      /**
       * @returns {string}
       */
      get() {
        return this.settings.unmSource || '';
      },
      /** @param {string?} value */
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'unmSource',
          value: value.length && value,
        });
      },
    },
    unmSearchMode: {
      get() {
        return this.settings.unmSearchMode || 'fast-first';
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'unmSearchMode',
          value: value,
        });
      },
    },
    unmEnableFlac: {
      get() {
        return this.settings.unmEnableFlac || false;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'unmEnableFlac',
          value: value || false,
        });
      },
    },
    unmProxyUri: {
      get() {
        return this.settings.unmProxyUri || '';
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'unmProxyUri',
          value: value.length && value,
        });
      },
    },
    unmJooxCookie: {
      get() {
        return this.settings.unmJooxCookie || '';
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'unmJooxCookie',
          value: value.length && value,
        });
      },
    },
    unmQQCookie: {
      get() {
        return this.settings.unmQQCookie || '';
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'unmQQCookie',
          value: value.length && value,
        });
      },
    },
    unmYtDlExe: {
      get() {
        return this.settings.unmYtDlExe || '';
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'unmYtDlExe',
          value: value.length && value,
        });
      },
    },
    enableCustomTitlebar: {
      get() {
        return this.settings.linuxEnableCustomTitlebar;
      },
      set(value) {
        this.$store.commit('updateSettings', {
          key: 'linuxEnableCustomTitlebar',
          value,
        });
      },
    },
    isLastfmConnected() {
      return this.lastfm.key !== undefined;
    },
  },
  created() {
    this.countDBSize('tracks');
    if (process.env.IS_ELECTRON) this.getAllOutputDevices();
    if (this.isAndroid) {
      this.cacheStatsTimer = setInterval(() => this.countDBSize(), 3000);
    }
  },
  watch: {
    '$route.hash'(hash) {
      if (hash === '#home-sections') {
        this.activeCategory = 'appearance';
        this.$nextTick(() =>
          document
            .getElementById('home-sections')
            ?.scrollIntoView({ block: 'start' })
        );
      }
    },
  },
  mounted() {
    if (this.$route.hash === '#home-sections')
      this.$nextTick(() =>
        document
          .getElementById('home-sections')
          ?.scrollIntoView({ block: 'start' })
      );
  },
  beforeDestroy() {
    clearInterval(this.cacheStatsTimer);
  },
  activated() {
    this.countDBSize('tracks');
    if (process.env.IS_ELECTRON) this.getAllOutputDevices();
  },
  methods: {
    categoryKey(event, key) {
      const index = this.categories.findIndex(item => item.key === key);
      let next = index;
      if (event.key === 'ArrowRight')
        next = (index + 1) % this.categories.length;
      else if (event.key === 'ArrowLeft')
        next = (index + this.categories.length - 1) % this.categories.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = this.categories.length - 1;
      else return;
      event.preventDefault();
      this.activeCategory = this.categories[next].key;
      this.$nextTick(() =>
        document.getElementById('settings-tab-' + this.activeCategory)?.focus()
      );
    },
    async copyMediaDiagnostic() {
      this.mediaDiagnostic =
        window.YesPlayMusicAndroid.getMediaDiagnostics?.() || '播放器尚未连接';
      await this.$nextTick();
      let copied = false;
      try {
        await navigator.clipboard.writeText(this.mediaDiagnostic);
        copied = true;
      } catch (_) {
        this.$refs.mediaDiagnostic.select();
        copied = document.execCommand('copy');
      }
      this.showToast(copied ? '诊断信息已复制' : '已显示诊断信息，可长按复制');
    },
    ...mapActions(['showToast']),
    saveAndroidApi() {
      try {
        if (!this.androidApiInput.trim()) {
          window.YesPlayMusicAndroid.setApiUrl('');
          window.location.reload();
          return;
        }
        const url = new URL(this.androidApiInput.trim());
        if (!['http:', 'https:'].includes(url.protocol))
          throw new Error('invalid URL');
        window.YesPlayMusicAndroid.setApiUrl(url.href.replace(/\/$/, ''));
        window.location.reload();
      } catch (error) {
        this.showToast(this.$t('settings.androidApi.invalid'));
      }
    },
    customCssError(error) {
      const key = error.message.startsWith('settings.customCss.')
        ? error.message
        : 'settings.customCss.loadFailed';
      this.showToast(this.$t(key));
    },
    async saveCustomCss() {
      this.customCssLoading = true;
      const address = this.customCssInput.trim();
      try {
        await applyCustomCss(address, this.customCssError);
        this.$store.commit('updateSettings', {
          key: 'customCssUrl',
          value: address,
        });
        this.customCssInput = address;
        this.showToast(
          this.$t(
            address
              ? 'settings.customCss.applied'
              : 'settings.customCss.cleared'
          )
        );
      } catch (error) {
        this.customCssError(error);
      } finally {
        this.customCssLoading = false;
      }
    },
    async reloadCustomCss() {
      this.customCssLoading = true;
      try {
        await applyCustomCss(this.settings.customCssUrl, this.customCssError);
        this.showToast(this.$t('settings.customCss.applied'));
      } catch (error) {
        this.customCssError(error);
      } finally {
        this.customCssLoading = false;
      }
    },
    clearCustomCss() {
      this.customCssInput = '';
      this.saveCustomCss();
    },
    async chooseCustomCss() {
      const result = await electron.remote.dialog.showOpenDialog({
        title: this.$t('settings.customCss.chooseFile'),
        properties: ['openFile'],
        filters: [{ name: 'CSS', extensions: ['css'] }],
      });
      if (result.canceled || !result.filePaths.length) return;
      this.customCssInput = result.filePaths[0];
      this.saveCustomCss();
    },
    getAllOutputDevices() {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        this.allOutputDevices = devices.filter(device => {
          return device.kind == 'audiooutput';
        });
        if (
          this.allOutputDevices.length > 0 &&
          this.allOutputDevices[0].label !== ''
        ) {
          this.withoutAudioPriviledge = false;
        } else {
          this.allOutputDevices = [
            {
              deviceId: 'default',
              label: 'settings.permissionRequired',
            },
          ];
        }
      });
    },
    toLogin() {
      this.$router.push({
        name: process.env.IS_ELECTRON === true ? 'loginAccount' : 'login',
      });
    },
    logout() {
      doLogout();
      this.$router.push({ name: 'home' });
    },
    async clearArtworkCache() {
      this.artworkClearing = true;
      await this.$nextTick();
      try {
        const { cancelArtworkSync } = await import('@/utils/libraryArtwork');
        cancelArtworkSync();
        window.YesPlayMusicAndroid.clearArtworkCache();
        this.countDBSize();
      } catch (error) {
        this.showToast('清除图片缓存失败，请稍后重试');
      } finally {
        this.artworkClearing = false;
      }
    },
    countDBSize() {
      if (this.isAndroid) {
        try {
          const artwork = JSON.parse(
            window.YesPlayMusicAndroid.getArtworkCacheStats()
          );
          this.artworkCache = { ...artwork, size: bytesToSize(artwork.bytes) };
          const stats = JSON.parse(
            window.YesPlayMusicAndroid.getAudioCacheStats()
          );
          if (stats.error) return;
          this.tracksCache.size = bytesToSize(stats.bytes);
          this.tracksCache.length = stats.length;
          this.tracksCache.partial = stats.partial;
        } catch (error) {
          console.debug('Unable to read native audio cache', error);
        }
        return;
      }
      countDBSize().then(data => {
        if (data === undefined) {
          this.tracksCache = {
            size: '0KB',
            length: 0,
          };
          return;
        }
        this.tracksCache.size = bytesToSize(data.bytes);
        this.tracksCache.length = data.length;
      });
    },
    async clearCache() {
      if (this.isAndroid) {
        this.cacheClearing = true;
        await this.$nextTick();
        try {
          const stats = JSON.parse(
            window.YesPlayMusicAndroid.clearAudioCache()
          );
          if (stats.error) throw new Error(stats.error);
          this.countDBSize();
        } catch (error) {
          this.showToast(error.message || '清除缓存失败，请稍后重试');
        } finally {
          this.cacheClearing = false;
        }
        return;
      }
      clearDB().then(() => {
        this.countDBSize();
      });
    },
    lastfmConnect() {
      lastfmAuth();
      let lastfmChecker = setInterval(() => {
        const session = localStorage.getItem('lastfm');
        if (session) {
          this.$store.commit('updateLastfm', JSON.parse(session));
          clearInterval(lastfmChecker);
        }
      }, 1000);
    },
    lastfmDisconnect() {
      localStorage.removeItem('lastfm');
      this.$store.commit('updateLastfm', {});
    },
    sendProxyConfig() {
      if (this.proxyProtocol === 'noProxy') return;
      const config = this.settings.proxyConfig;
      if (
        config.server === '' ||
        !config.port ||
        config.protocol === 'noProxy'
      ) {
        ipcRenderer.send('removeProxy');
      } else {
        ipcRenderer.send('setProxy', config);
      }
      this.showToast('已更新代理设置');
    },
    clickOutside() {
      this.exitRecordShortcut();
    },
    formatShortcut(shortcut) {
      shortcut = shortcut
        .replaceAll('+', ' + ')
        .replace('Up', '↑')
        .replace('Down', '↓')
        .replace('Right', '→')
        .replace('Left', '←');
      if (this.settings.lang === 'zh-CN') {
        shortcut = shortcut.replace('Space', '空格');
      } else if (this.settings.lang === 'zh-TW') {
        shortcut = shortcut.replace('Space', '空白鍵');
      }
      if (process.platform === 'darwin') {
        return shortcut
          .replace('CommandOrControl', '⌘')
          .replace('Command', '⌘')
          .replace('Alt', '⌥')
          .replace('Control', '⌃')
          .replace('Shift', '⇧');
      }
      return shortcut.replace('CommandOrControl', 'Ctrl');
    },
    readyToRecordShortcut(id, type) {
      if (type === 'globalShortcut' && this.enableGlobalShortcut === false) {
        return;
      }
      this.shortcutInput = { id, type, recording: true };
      this.recordedShortcut = [];
      ipcRenderer.send('switchGlobalShortcutStatusTemporary', 'disable');
    },
    handleShortcutKeydown(e) {
      if (this.shortcutInput.recording === false) return;
      e.preventDefault();
      if (this.recordedShortcut.find(s => s.keyCode === e.keyCode)) return;
      this.recordedShortcut.push(e);
      if (
        (e.keyCode >= 65 && e.keyCode <= 90) || // A-Z
        (e.keyCode >= 48 && e.keyCode <= 57) || // 0-9
        (e.keyCode >= 112 && e.keyCode <= 123) || // F1-F12
        ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key) || // Arrows
        validShortcutCodes.includes(e.key)
      ) {
        this.saveShortcut();
      }
    },
    handleShortcutKeyup(e) {
      if (this.recordedShortcut.find(s => s.keyCode === e.keyCode)) {
        this.recordedShortcut = this.recordedShortcut.filter(
          s => s.keyCode !== e.keyCode
        );
      }
    },
    saveShortcut() {
      const { id, type } = this.shortcutInput;
      const payload = {
        id,
        type,
        shortcut: this.recordedShortcutComputed,
      };
      this.$store.commit('updateShortcut', payload);
      ipcRenderer.send('updateShortcut', payload);
      this.showToast('快捷键已保存');
      this.recordedShortcut = [];
    },
    exitRecordShortcut() {
      if (this.shortcutInput.recording === false) return;
      this.shortcutInput = { id: '', type: '', recording: false };
      this.recordedShortcut = [];
      ipcRenderer.send('switchGlobalShortcutStatusTemporary', 'enable');
    },
    restoreDefaultShortcuts() {
      this.$store.commit('restoreDefaultShortcuts');
      ipcRenderer.send('restoreDefaultShortcuts');
    },
  },
};
</script>

<style lang="scss" scoped>
.settings-page {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}
.container {
  margin-top: 24px;
  width: 720px;
}
h2 {
  margin-top: 48px;
  font-size: 36px;
  color: var(--color-text);
}

h3 {
  margin-top: 48px;
  padding-bottom: 12px;
  font-size: 26px;
  color: var(--color-text);
  border-bottom: 1px solid rgba(128, 128, 128, 0.18);
}

.container > h3:first-child {
  margin-top: 0;
}

h4 {
  margin-top: 28px;
  font-size: 18px;
  color: var(--color-text);
}

.user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-secondary-bg);
  color: var(--color-text);
  padding: 16px 20px;
  border-radius: 16px;
  margin-bottom: 48px;
  img.avatar {
    border-radius: 50%;
    height: 64px;
    width: 64px;
  }
  img.cvip {
    height: 13px;
    margin-right: 4px;
  }
  .left {
    display: flex;
    align-items: center;
    .info {
      margin-left: 24px;
    }
    .nickname {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .extra-info {
      font-size: 13px;
      .text {
        opacity: 0.68;
      }
      .vip {
        display: flex;
        align-items: center;
      }
    }
  }
  .right {
    .svg-icon {
      height: 18px;
      width: 18px;
      margin-right: 4px;
    }
    button {
      display: flex;
      align-items: center;
      font-size: 18px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 10px;
      padding: 8px 12px;
      opacity: 0.68;
      color: var(--color-text);
      transition: 0.2s;
      margin: {
        right: 12px;
        left: 12px;
      }
      &:hover {
        opacity: 1;
        background: var(--color-primary-bg);
        color: var(--color-primary);
      }
      &:active {
        opacity: 1;
        transform: scale(0.92);
        transition: 0.2s;
      }
    }
  }
}

.item {
  margin: 24px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text);

  .title {
    font-size: 16px;
    font-weight: 500;
    opacity: 0.78;
  }

  .description {
    font-size: 14px;
    margin-top: 0.5em;
    opacity: 0.7;
  }
}

select {
  min-width: 192px;
  max-width: 600px;
  font-weight: 600;
  border: none;
  padding: 8px 12px 8px 12px;
  border-radius: 8px;
  color: var(--color-text);
  background: var(--color-secondary-bg);
  appearance: none;
  &:focus {
    outline: none;
    color: var(--color-primary);
    background: var(--color-primary-bg);
  }
}

button {
  color: var(--color-text);
  background: var(--color-secondary-bg);
  padding: 8px 12px 8px 12px;
  font-weight: 600;
  border-radius: 8px;
  transition: 0.2s;
  &:hover {
    transform: scale(1.06);
  }
  &:active {
    transform: scale(0.94);
  }
}

.custom-css-item {
  align-items: flex-start;
  gap: 24px;
  .left {
    max-width: 280px;
  }
  .description {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.5;
    opacity: 0.68;
  }
  .custom-css-form {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
  input.text-input {
    width: 100%;
    margin-right: 0;
    box-sizing: border-box;
  }
  .custom-css-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
    transform: none;
  }
}

input.text-input.margin-right-0 {
  margin-right: 0;
}
input.text-input {
  background: var(--color-secondary-bg);
  border: none;
  margin-right: 22px;
  padding: 8px 12px 8px 12px;
  border-radius: 8px;
  color: var(--color-text);
  font-weight: 600;
  font-size: 16px;
}
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}
input[type='number'] {
  -moz-appearance: textfield;
}

#proxy-form,
#real-ip {
  display: flex;
  align-items: center;
}
#proxy-form.disabled,
#real-ip.disabled {
  opacity: 0.47;
  button:hover {
    transform: unset;
  }
}

#shortcut-table {
  font-size: 14px;
  /* border: 1px solid black; */
  user-select: none;
  color: var(--color-text);
  .row {
    display: flex;
  }
  .row.row-head {
    opacity: 0.58;
    font-size: 13px;
    font-weight: 500;
  }
  .col {
    min-width: 192px;
    padding: 8px;
    display: flex;
    align-items: center;
    /* border: 1px solid red; */
    &:first-of-type {
      padding-left: 0;
      min-width: 128px;
    }
  }
  .keyboard-input {
    font-weight: 600;
    background-color: var(--color-secondary-bg);
    padding: 8px 12px 8px 12px;
    border-radius: 0.5rem;
    min-width: 146px;
    min-height: 34px;
    box-sizing: border-box;
    &.active {
      color: var(--color-primary);
      background-color: var(--color-primary-bg);
    }
  }
  .restore-default-shortcut {
    margin-top: 12px;
  }
  &.global-disabled {
    .row .col:last-child {
      opacity: 0.48;
    }
    .row.row-head .col:last-child {
      opacity: 1;
    }
  }
  &:focus {
    outline: none;
  }
}

.footer {
  text-align: center;
  margin-top: 6rem;
  color: var(--color-text);
  font-weight: 600;
  .author {
    font-size: 0.9rem;
  }
  .version {
    font-size: 0.88rem;
    opacity: 0.58;
    margin-top: -10px;
  }
}

.beforeAnimation {
  -webkit-transition: 0.2s cubic-bezier(0.24, 0, 0.5, 1);
  transition: 0.2s cubic-bezier(0.24, 0, 0.5, 1);
}
.afterAnimation {
  box-shadow: 0 0 0 1px hsla(0, 0%, 0%, 0.1), 0 4px 0px 0 hsla(0, 0%, 0%, 0.04),
    0 4px 9px hsla(0, 0%, 0%, 0.13), 0 3px 3px hsla(0, 0%, 0%, 0.05);
  -webkit-transition: 0.35s cubic-bezier(0.54, 1.6, 0.5, 1);
  transition: 0.35s cubic-bezier(0.54, 1.6, 0.5, 1);
}
.toggle {
  margin: auto;
}
.toggle input {
  opacity: 0;
  position: absolute;
}
.toggle input + label {
  position: relative;
  display: inline-block;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-transition: 0.4s ease;
  transition: 0.4s ease;
  height: 32px;
  width: 52px;
  background: var(--color-secondary-bg);
  border-radius: 8px;
}
.toggle input + label:before {
  content: '';
  position: absolute;
  display: block;
  -webkit-transition: 0.2s cubic-bezier(0.24, 0, 0.5, 1);
  transition: 0.2s cubic-bezier(0.24, 0, 0.5, 1);
  height: 32px;
  width: 52px;
  top: 0;
  left: 0;
  border-radius: 8px;
}
.toggle input + label:after {
  content: '';
  position: absolute;
  display: block;
  box-shadow: 0 0 0 1px hsla(0, 0%, 0%, 0.02), 0 4px 0px 0 hsla(0, 0%, 0%, 0.01),
    0 4px 9px hsla(0, 0%, 0%, 0.08), 0 3px 3px hsla(0, 0%, 0%, 0.03);
  -webkit-transition: 0.35s cubic-bezier(0.54, 1.6, 0.5, 1);
  transition: 0.35s cubic-bezier(0.54, 1.6, 0.5, 1);
  background: #fff;
  height: 20px;
  width: 20px;
  top: 6px;
  left: 6px;
  border-radius: 6px;
}
.toggle input:checked + label:before {
  background: var(--color-primary-gradient);
  -webkit-transition: width 0.2s cubic-bezier(0, 0, 0, 0.1);
  transition: width 0.2s cubic-bezier(0, 0, 0, 0.1);
}
.toggle input:checked + label:after {
  left: 26px;
}
</style>

<style lang="scss" scoped>
.media-diagnostic {
  flex-wrap: wrap;
  textarea {
    width: 100%;
    min-height: 160px;
    margin-top: 12px;
    background: var(--color-secondary-bg);
    color: var(--color-text);
    border: none;
    border-radius: 8px;
    padding: 12px;
    box-sizing: border-box;
  }
}
</style>

<style lang="scss" scoped>
.settings-subgroup {
  margin: 24px 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  opacity: 0.65;
}
</style>

<style lang="scss" scoped>
.settings-page {
  display: block;
  margin: 0 auto;
  padding: 24px 0 56px;
  width: 100%;
  max-width: 900px;
  color: var(--color-text);
}
.container {
  width: 100%;
  margin: 0;
  min-width: 0;
}
.settings-heading h1 {
  margin: 0 0 24px;
  font-size: 34px;
  font-weight: 750;
  letter-spacing: -0.8px;
}
.user {
  margin: 0 0 24px;
  padding: 20px 24px;
  border-radius: 20px;
  border: 1px solid rgba(128, 128, 128, 0.12);
  background: var(--color-secondary-bg);
  gap: 16px;
  img.avatar {
    width: 52px;
    height: 52px;
    flex-shrink: 0;
  }
  .left {
    min-width: 0;
    .info {
      min-width: 0;
      margin-left: 16px;
    }
    .nickname {
      font-size: 19px;
      overflow-wrap: anywhere;
    }
    .extra-info {
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
  }
  .right {
    flex-shrink: 0;
    button {
      margin: 0;
      font-size: 14px;
      opacity: 1;
      .svg-icon {
        width: 15px;
        height: 15px;
      }
    }
  }
}
.settings-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 6px;
  border: 1px solid rgba(128, 128, 128, 0.14);
  border-radius: 18px;
  background: var(--color-secondary-bg-for-transparent);
  button {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    padding: 15px 18px;
    border: 1px solid transparent;
    border-radius: 12px;
    text-align: left;
    background: transparent;
    transform: none;
    strong {
      font-size: 17px;
      font-weight: 650;
    }
    span {
      font-size: 12px;
      font-weight: 400;
      opacity: 0.56;
    }
    &:hover {
      background: var(--color-secondary-bg);
    }
    &.active {
      background: var(--color-body-bg);
      border-color: rgba(128, 128, 128, 0.18);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      color: var(--color-primary);
      span {
        color: var(--color-text);
        opacity: 0.7;
      }
    }
  }
}
.settings-panel {
  outline: none;
}
.panel-title {
  margin: 28px 0 16px;
  padding: 0;
  font-size: 22px;
  font-weight: 650;
  border: none;
}
.settings-cards {
  display: grid;
  gap: 16px;
}
.settings-card {
  min-width: 0;
  padding: 22px 24px 8px;
  border: 1px solid rgba(128, 128, 128, 0.14);
  border-radius: 18px;
  background: var(--color-body-bg);
}
.card-heading {
  margin: 0 0 4px;
  padding-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.4px;
  opacity: 0.56;
}
.settings-card > .item {
  margin: 0;
  padding: 18px 0;
  gap: 28px;
  border-top: 1px solid rgba(128, 128, 128, 0.1);
  > .left {
    flex: 1;
    min-width: 0;
  }
  > .right {
    flex: 0 0 auto;
    max-width: 54%;
    min-width: 0;
  }
  .title {
    font-size: 15px;
    font-weight: 550;
    opacity: 1;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .description {
    margin-top: 5px;
    font-size: 12px;
    line-height: 1.65;
    opacity: 0.55;
    max-width: 52ch;
    overflow-wrap: anywhere;
  }
}
.settings-card .item {
  color: inherit;
}
.settings-card select {
  width: 180px;
  min-width: 140px;
  max-width: 100%;
  padding: 11px 34px 11px 13px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid rgba(128, 128, 128, 0.1);
  border-radius: 10px;
  background-color: var(--color-secondary-bg);
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m1 1 4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 13px center;
}
.settings-card button,
.login-entry button {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 550;
  border: 1px solid rgba(128, 128, 128, 0.1);
  border-radius: 10px;
  transform: none;
  &:hover {
    background: var(--color-primary-bg);
    color: var(--color-primary);
  }
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}
.settings-card .custom-css-item,
.settings-card .android-api-address {
  display: block;
  > .left {
    max-width: none;
    margin-bottom: 14px;
  }
  > .right {
    max-width: none;
    width: 100%;
    display: flex;
    gap: 8px;
    align-items: stretch;
  }
  .custom-css-form {
    flex-direction: column;
  }
}
.settings-card input.text-input {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  margin-right: 0;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 400;
  border: 1px solid rgba(128, 128, 128, 0.14);
  border-radius: 10px;
}
.android-api-address input {
  flex: 1;
}
.settings-card .custom-css-actions {
  margin-top: 2px;
  gap: 8px;
}
.settings-card .media-diagnostic {
  > .right {
    max-width: 100%;
  }
  textarea {
    font: 12px/1.6 monospace;
    resize: vertical;
  }
}
.settings-card #proxy-form,
.settings-card #real-ip {
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 18px;
}
.settings-card #shortcut-table {
  overflow-x: auto;
  padding-bottom: 12px;
}
.settings-card .unm-configuration > h4,
.settings-card > div > h4 {
  margin: 16px 0;
  font-size: 15px;
}
.settings-card .toggle {
  margin: 0;
  height: 28px;
}
.settings-card .toggle input + label,
.settings-card .toggle input + label:before {
  width: 46px;
  height: 28px;
  border-radius: 18px;
}
.settings-card .toggle input + label {
  background: rgba(128, 128, 128, 0.2);
}
.settings-card .toggle input + label:after {
  width: 20px;
  height: 20px;
  top: 4px;
  left: 4px;
  border-radius: 50%;
}
.settings-card .toggle input:checked + label:after {
  left: 22px;
}
.settings-card .toggle input:focus-visible + label {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}
.settings-card ::v-deep .player-button-settings,
.settings-card ::v-deep .home-section-settings {
  margin: 0 0 14px;
  border: none;
  border-radius: 0;
  padding: 0;
  background: transparent;
  summary {
    padding: 12px 0;
    font-size: 15px;
  }
}
.footer {
  margin: 36px 0 0;
  padding: 24px 0 0;
  border-top: 1px solid rgba(128, 128, 128, 0.12);
  line-height: 1.7;
  font-weight: 400;
  .version {
    margin-top: 8px;
  }
  a {
    color: inherit;
  }
}
@media (max-width: 600px) {
  .settings-page {
    padding-top: 12px;
  }
  .settings-heading h1 {
    font-size: 28px;
    margin-bottom: 20px;
  }
  .user {
    padding: 16px;
    border-radius: 16px;
    .left .info {
      margin-left: 12px;
    }
    .left .nickname {
      font-size: 17px;
    }
    .right button {
      font-size: 12px;
      padding: 8px;
    }
  }
  .settings-tabs {
    gap: 3px;
    padding: 4px;
    border-radius: 14px;
    button {
      padding: 12px 8px;
      align-items: center;
      strong {
        font-size: 15px;
      }
      span {
        font-size: 10px;
      }
    }
  }
  .panel-title {
    font-size: 20px;
    margin-top: 24px;
  }
  .settings-card {
    padding: 18px 16px 4px;
    border-radius: 16px;
  }
  .settings-card > .item {
    gap: 16px;
    padding: 16px 0;
    > .right {
      max-width: 52%;
    }
    .title {
      font-size: 14px;
    }
    .description {
      font-size: 12px;
    }
  }
  .settings-card select {
    width: 142px;
    min-width: 0;
    font-size: 13px;
    padding-left: 10px;
  }
  .settings-card .custom-css-item > .right,
  .settings-card .android-api-address > .right {
    max-width: none;
  }
  .settings-card .custom-css-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .settings-card .media-diagnostic > .right {
    max-width: 100%;
  }
}
@media (max-width: 360px) {
  .settings-tabs button span {
    display: none;
  }
  .settings-card > .item {
    gap: 10px;
  }
  .settings-card select {
    width: 122px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .settings-tabs button {
    transition: none;
  }
}
</style>
