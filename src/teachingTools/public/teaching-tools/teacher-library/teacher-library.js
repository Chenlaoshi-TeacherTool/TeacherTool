(function () {
  'use strict';

  var find = function (id) { return document.getElementById(id); };
  var base = '/api/teacher-library';
  var cloud = null;
  var plan = null;
  var local;
  var busy = false;
  var epoch = 0;
  var accountId = null;
  try { local = window.ChenLibraryStore.create(localStorage, navigator.locks); } catch (error) {}

  function element(tag, value) { var node = document.createElement(tag); node.textContent = value; return node; }
  function reset() { plan = null; find('confirmExchange').checked = false; find('confirmLabel').hidden = true; find('applyExchange').disabled = true; }
  async function request(url, options) {
    var response = await fetch(base + url, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, options));
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || '请求未完成，请重新读取云库。');
    return data;
  }
  function summary(data) { return data.collections.length + ' 个集合，' + data.collections.reduce(function (total, collection) { return total + collection.items.length; }, 0) + ' 条材料'; }

  async function refresh() {
    var selected = ++epoch;
    reset();
    cloud = null;
    accountId = null;
    find('accountStatus').removeAttribute('data-account-id');
    find('cloudWorkspace').hidden = true;
    find('cloudCollections').replaceChildren();
    find('loginLinks').replaceChildren();
    find('logoutLink').hidden = true;
    find('previewUpload').disabled = true;
    find('previewRestore').disabled = true;
    find('downloadCloud').disabled = true;
    try {
      var session = await request('/session');
      if (selected !== epoch) return;
      window.dispatchEvent(new CustomEvent('teacher-session', { detail: { session: session, cloud: null } }));
      if (!session.available) { find('accountStatus').textContent = '老师注册登录尚未开放，现有免费工具仍可使用。'; return; }
      if (!session.signedIn) {
        find('accountStatus').textContent = '请使用老师自己的账号登录。';
        session.login.forEach(function (login) { var link = element('a', login.provider === 'teachers' ? '邮箱注册／登录（可选已配置的 Google）' : login.provider === 'google' ? '使用 Google 登录' : '使用 Microsoft 登录'); link.href = login.url; find('loginLinks').appendChild(link); });
        return;
      }
      accountId = session.accountId;
      find('accountStatus').textContent = '已登录：' + session.user.name + '。';
      find('accountStatus').dataset.accountId = accountId;
      find('logoutLink').href = session.logout;
      find('logoutLink').hidden = false;
      if (session.cloudAvailable === false) { find('accountStatus').textContent = '已登录：' + session.user.name + '。云端保存尚未开放，可先创建本地草稿。'; return; }
      var loaded = await request('/mine');
      if (selected !== epoch) return;
      if (loaded.accountId !== accountId) throw new Error('登录账号已变化，请重新读取云库。');
      cloud = loaded;
      window.dispatchEvent(new CustomEvent('teacher-session', { detail: { session: session, cloud: cloud } }));
      find('cloudWorkspace').hidden = false;
      find('cloudStatus').textContent = (cloud.library ? summary(cloud.library) : '云库中还没有材料') + '。' + (cloud.canWrite ? '当前账号可保存云库。' : '当前只可查看和导出；需要管理员开通云端保存权限。');
      if (cloud.library) cloud.library.collections.forEach(function (collection) {
        var details = document.createElement('details');
        details.appendChild(element('summary', collection.name + ' · ' + collection.items.length + ' 条'));
        var list = document.createElement('ul');
        collection.items.forEach(function (item) { list.appendChild(element('li', item.kind === 'question' ? item.prompt + ' — ' + item.answer : item.term + ' — ' + item.definition)); });
        details.appendChild(list);
        find('cloudCollections').appendChild(details);
      });
      find('previewUpload').disabled = !cloud.canWrite || !local;
      find('previewRestore').disabled = !cloud.library || !local;
      find('downloadCloud').disabled = !cloud.library;
    } catch (error) { if (selected === epoch) find('accountStatus').textContent = error.message; }
  }

  async function prepare(direction) {
    reset();
    var selected = ++epoch;
    try {
      if (!cloud || !local) return;
      if (direction === 'upload') {
        var loaded = await local.load();
        if (selected !== epoch) return;
        if (!loaded.data.collections.length) throw new Error('本浏览器的统一库没有材料，请先在 My Library 中保存词表或题库。');
        plan = { direction: direction, data: loaded.data, raw: loaded.raw, revision: cloud.revision, accountId: accountId };
        find('exchangeStatus').textContent = '本地待上传：' + summary(loaded.data) + '；当前云库：' + (cloud.library ? summary(cloud.library) : '空') + '。';
        find('confirmText').textContent = '确认用这份本地材料替换当前账号的云端快照；云端已有材料请先下载备份。';
      } else {
        var prepared = await local.prepare(cloud.library);
        if (selected !== epoch) return;
        plan = { direction: direction, localPlan: prepared, accountId: accountId };
        find('exchangeStatus').textContent = prepared.entries.map(function (entry) { return entry.name + '：' + ({new: '新增', duplicate: '重复跳过', conflict: '冲突，保留双方'})[entry.status]; }).join('；');
        find('confirmText').textContent = '确认把云端材料加入本浏览器，重复跳过、冲突保留双方，不替换本地已有材料。';
      }
      find('confirmLabel').hidden = false;
    } catch (error) { find('exchangeStatus').textContent = error.message; }
  }

  find('previewUpload').addEventListener('click', function () { prepare('upload'); });
  find('previewRestore').addEventListener('click', function () { prepare('restore'); });
  find('confirmExchange').addEventListener('change', function () { find('applyExchange').disabled = !plan || !find('confirmExchange').checked || busy; });
  find('reloadCloud').addEventListener('click', refresh);
  find('downloadCloud').addEventListener('click', function () {
    if (!cloud || !cloud.library) return;
    var url = URL.createObjectURL(new Blob([JSON.stringify(cloud.library, null, 2)], { type: 'application/json' }));
    var link = document.createElement('a'); link.href = url; link.download = 'my-private-cloud-library.json'; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  });
  find('applyExchange').addEventListener('click', async function () {
    if (!plan || busy || !find('confirmExchange').checked) return;
    var pending = plan;
    busy = true;
    find('applyExchange').disabled = true;
    try {
      var session = await request('/session');
      if (!session.signedIn || session.accountId !== pending.accountId || plan !== pending) throw new Error('登录账号或预览已变化，请重新读取云库。');
      if (pending.direction === 'upload') {
        if ((await local.load()).raw !== pending.raw) throw new Error('本地材料已变化，请重新预览后保存。');
        if (plan !== pending) throw new Error('预览已变化，请重新读取云库。');
        await request('/mine', { method: 'PUT', headers: { 'Content-Type': 'application/vnd.cls-library+json', 'X-Library-Request': 'save', 'X-Library-Account': pending.accountId, 'If-Match': '"' + pending.revision + '"' }, body: JSON.stringify(pending.data) });
        find('exchangeStatus').textContent = '云端保存成功。';
      } else {
        await local.save(pending.localPlan, true);
        find('exchangeStatus').textContent = '云端材料已加入本浏览器，可返回 My Library 或 Maze 使用。';
      }
      await refresh();
    } catch (error) { reset(); find('exchangeStatus').textContent = error.message; }
    finally { busy = false; }
  });
  window.addEventListener('focus', function () { if (!busy) refresh(); });
  refresh();
})();
