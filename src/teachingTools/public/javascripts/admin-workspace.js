(function () {
  'use strict';
  var dirty = new Set();
  var status = document.getElementById('admin-save-status');
  document.querySelectorAll('form').forEach(function (form) {
    if ((form.method || '').toLowerCase() !== 'post') return;
    form.addEventListener('input', function () {
      dirty.add(form);
      if (status) { status.hidden = false; status.textContent = '有未保存的修改，请保存后再离开。'; }
    });
    form.addEventListener('submit', function (event) { if (!event.defaultPrevented) dirty.clear(); });
  });
  window.addEventListener('beforeunload', function (event) {
    if (!dirty.size) return;
    event.preventDefault();
    event.returnValue = '';
  });
  document.querySelectorAll('[data-admin-filter]').forEach(function (input) {
    var table = document.getElementById(input.getAttribute('data-admin-filter'));
    if (!table) return;
    input.addEventListener('input', function () {
      var query = input.value.trim().toLocaleLowerCase();
      table.querySelectorAll('tbody tr').forEach(function (row) {
        row.hidden = row.textContent.toLocaleLowerCase().indexOf(query) === -1;
      });
    });
  });
  document.querySelectorAll('body > table').forEach(function (table) {
    var wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    table.before(wrapper);
    wrapper.appendChild(table);
  });
})();
