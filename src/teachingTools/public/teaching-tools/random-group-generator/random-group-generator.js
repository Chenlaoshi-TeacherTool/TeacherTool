(function () {
  'use strict';

  var namesInput = document.getElementById('names');
  var groupSizeInput = document.getElementById('groupSize');
  var groupCountInput = document.getElementById('groupCount');
  var countNode = document.getElementById('studentCount');
  var previewNode = document.getElementById('groupingPreview');
  var statusNode = document.getElementById('groupStatus');
  var outputNode = document.getElementById('groupOutput');
  var summaryNode = document.getElementById('resultSummary');
  var reshuffleButton = document.getElementById('reshuffleGroups');
  var copyButton = document.getElementById('copyGroups');
  var lastGroups = [];
  var hasGenerated = false;
  var accents = ['#6f9e72', '#e6aa2b', '#c76e62', '#6596a1', '#9a76a2', '#4d8f78'];
  var sampleNames = ['Ava', 'Mateo', 'Sofia', 'Noah', 'Liam', 'Maya', 'Ethan', 'Zoe', 'Lucas', 'Amelia', 'Kai', 'Isabella', 'Leo', 'Nora', 'Elijah', 'Mia', 'Daniel', 'Lily'];

  function studentNames() {
    return namesInput.value.split(/\r?\n/).map(function (name) { return name.trim(); }).filter(Boolean);
  }

  function selectedMode() {
    var selected = document.querySelector('input[name="groupMode"]:checked');
    return selected ? selected.value : 'size';
  }

  function positiveInteger(input) {
    var value = Number.parseInt(input.value, 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function shuffle(items) {
    var result = items.slice();
    for (var index = result.length - 1; index > 0; index -= 1) {
      var target = Math.floor(Math.random() * (index + 1));
      var temporary = result[index];
      result[index] = result[target];
      result[target] = temporary;
    }
    return result;
  }

  function groupPlan(names) {
    var mode = selectedMode();
    if (!names.length) return { valid: false, message: 'Add student names to preview your groups.' };
    if (names.length < 2) return { valid: false, message: 'Add at least 2 student names to make groups.' };
    if (mode === 'size') {
      var size = positiveInteger(groupSizeInput);
      if (size < 2) return { valid: false, message: 'Choose at least 2 students per group.' };
      var sizeGroupCount = Math.ceil(names.length / size);
      return { valid: true, mode: mode, value: size, count: sizeGroupCount, message: sizeGroupCount + ' group' + (sizeGroupCount === 1 ? '' : 's') + ', with up to ' + size + ' students in each.' };
    }
    var requested = positiveInteger(groupCountInput);
    if (requested < 2) return { valid: false, message: 'Choose at least 2 groups.' };
    var actual = Math.min(requested, names.length);
    var smallest = Math.floor(names.length / actual);
    var largest = Math.ceil(names.length / actual);
    return { valid: true, mode: mode, value: actual, count: actual, message: actual + ' balanced groups, with ' + (smallest === largest ? smallest : smallest + '–' + largest) + ' students in each.' };
  }

  function updateInterface() {
    var names = studentNames();
    var mode = selectedMode();
    countNode.textContent = names.length + ' student' + (names.length === 1 ? '' : 's');
    countNode.classList.toggle('has-students', names.length > 0);
    groupSizeInput.disabled = mode !== 'size';
    groupCountInput.disabled = mode !== 'count';
    document.querySelectorAll('[data-mode-card]').forEach(function (card) { card.classList.toggle('is-selected', card.dataset.modeCard === mode); });
    previewNode.textContent = groupPlan(names).message;
    statusNode.textContent = '';
    statusNode.className = 'group-status';
  }

  function makeGroups(names, plan) {
    var mixed = shuffle(names);
    var groups = [];
    if (plan.mode === 'size') {
      for (var index = 0; index < mixed.length; index += plan.value) groups.push(mixed.slice(index, index + plan.value));
      return groups;
    }
    for (var groupIndex = 0; groupIndex < plan.value; groupIndex += 1) groups.push([]);
    mixed.forEach(function (name, index) { groups[index % groups.length].push(name); });
    return groups;
  }

  function initials(name) {
    var pieces = name.split(/\s+/).filter(Boolean);
    return pieces.slice(0, 2).map(function (piece) { return piece.charAt(0).toUpperCase(); }).join('') || '?';
  }

  function renderGroups(groups) {
    outputNode.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'group-grid';
    groups.forEach(function (group, groupIndex) {
      var card = document.createElement('article');
      card.className = 'group-card';
      card.style.setProperty('--group-accent', accents[groupIndex % accents.length]);
      var header = document.createElement('header');
      header.className = 'group-card__header';
      var title = document.createElement('h3');
      title.textContent = 'Group ' + (groupIndex + 1);
      var total = document.createElement('span');
      total.textContent = group.length + ' student' + (group.length === 1 ? '' : 's');
      header.append(title, total);
      var list = document.createElement('ol');
      group.forEach(function (name) {
        var item = document.createElement('li');
        var avatar = document.createElement('span');
        avatar.textContent = initials(name);
        item.append(avatar, document.createTextNode(name));
        list.appendChild(item);
      });
      card.append(header, list);
      grid.appendChild(card);
    });
    outputNode.appendChild(grid);
  }

  function generateGroups(shouldScroll) {
    var names = studentNames();
    var plan = groupPlan(names);
    if (!plan.valid) {
      statusNode.textContent = plan.message;
      statusNode.className = 'group-status';
      return;
    }
    lastGroups = makeGroups(names, plan);
    renderGroups(lastGroups);
    summaryNode.textContent = lastGroups.length + ' groups made from ' + names.length + ' students.';
    reshuffleButton.disabled = false;
    copyButton.disabled = false;
    statusNode.textContent = 'Groups are ready.';
    statusNode.className = 'group-status is-success';
    if (shouldScroll && !hasGenerated) document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    hasGenerated = true;
  }

  function resetResults() {
    lastGroups = [];
    hasGenerated = false;
    outputNode.innerHTML = '<div class="group-empty-state"><span aria-hidden="true">🎲</span><strong>No groups yet</strong><p>Your shuffled teams will be easy to scan and copy from here.</p></div>';
    summaryNode.textContent = 'Groups will appear here after you add names.';
    reshuffleButton.disabled = true;
    copyButton.disabled = true;
  }

  function handlePlanChange() {
    updateInterface();
    if (hasGenerated) resetResults();
  }

  function copyGroups() {
    if (!lastGroups.length) return;
    var text = lastGroups.map(function (group, index) { return 'Group ' + (index + 1) + ': ' + group.join(', '); }).join('\n');
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      statusNode.textContent = 'Copy is unavailable in this browser. Select the group names to copy them.';
      statusNode.className = 'group-status';
      return;
    }
    navigator.clipboard.writeText(text).then(function () {
      statusNode.textContent = 'Groups copied to your clipboard.';
      statusNode.className = 'group-status is-success';
    }).catch(function () {
      statusNode.textContent = 'The groups could not be copied. Please try again.';
      statusNode.className = 'group-status';
    });
  }

  namesInput.addEventListener('input', function () { updateInterface(); if (hasGenerated) resetResults(); });
  document.querySelectorAll('input[name="groupMode"]').forEach(function (radio) { radio.addEventListener('change', handlePlanChange); });
  groupSizeInput.addEventListener('input', handlePlanChange);
  groupCountInput.addEventListener('input', handlePlanChange);
  document.getElementById('generateGroups').addEventListener('click', function () { generateGroups(true); });
  reshuffleButton.addEventListener('click', function () { generateGroups(false); });
  copyButton.addEventListener('click', copyGroups);
  document.getElementById('loadGroupSample').addEventListener('click', function () {
    namesInput.value = sampleNames.join('\n');
    resetResults();
    updateInterface();
    namesInput.focus();
  });
  document.getElementById('clearGroupNames').addEventListener('click', function () {
    namesInput.value = '';
    resetResults();
    updateInterface();
    namesInput.focus();
  });

  updateInterface();
}());
