(function () {
  'use strict';

  var STORAGE_KEY = 'chenlaoshi-class-pet-points-v1';
  var BACKUP_VERSION = 1;
  var MAX_STUDENTS = 60;
  var MAX_HISTORY = 100;
  var saveTimer = null;
  var toastTimer = null;
  var pickerStudentId = null;
  var skinPickerStudentId = null;

  var PETS = [
    { name: 'Golden Pup', atlas: 1, cell: 0 },
    { name: 'Mint Kitten', atlas: 1, cell: 1 },
    { name: 'Lavender Bunny', atlas: 1, cell: 2 },
    { name: 'Coral Panda', atlas: 1, cell: 3 },
    { name: 'Aqua Dragon', atlas: 1, cell: 4 },
    { name: 'Indigo Owl', atlas: 1, cell: 5 },
    { name: 'Sunshine Fox', atlas: 2, cell: 0 },
    { name: 'Sky Fawn', atlas: 2, cell: 1 },
    { name: 'Lime Hedgehog', atlas: 2, cell: 2 },
    { name: 'Pink Squirrel', atlas: 2, cell: 3 },
    { name: 'Honey Bear', atlas: 2, cell: 4 },
    { name: 'Teal Raccoon', atlas: 2, cell: 5 },
    { name: 'Orange Hamster', atlas: 3, cell: 0 },
    { name: 'Purple Guinea Pig', atlas: 3, cell: 1 },
    { name: 'Rosy Lamb', atlas: 3, cell: 2 },
    { name: 'Violet Alpaca', atlas: 3, cell: 3 },
    { name: 'Sunny Duck', atlas: 3, cell: 4 },
    { name: 'Aqua Penguin', atlas: 3, cell: 5 },
    { name: 'Bubble Axolotl', atlas: 4, cell: 0 },
    { name: 'Rainbow Unicorn', atlas: 4, cell: 1 },
    { name: 'Starry Seal', atlas: 4, cell: 2 },
    { name: 'Green Turtle', atlas: 4, cell: 3 },
    { name: 'Coral Koala', atlas: 4, cell: 4 },
    { name: 'Cloud Lion', atlas: 4, cell: 5 }
  ];

  var STAGES = [
    { level: 1, min: 0, next: 10, name: 'Egg', icon: '🥚' },
    { level: 2, min: 10, next: 20, name: 'Cracked Egg', icon: '🐣' },
    { level: 3, min: 20, next: 50, name: 'Baby', icon: '🐾' },
    { level: 4, min: 50, next: 100, name: 'Chubby Form', icon: '💛' },
    { level: 5, min: 100, next: 150, name: 'Cute Adult', icon: '🌟' },
    { level: 6, min: 150, next: 200, name: 'Sparkle Form', icon: '✨' }
  ];

  var SKINS = [
    { id: 'none', name: 'No holiday skin', icon: '🐾', description: 'Show the pet in its regular growth form.' },
    { id: 'christmas', name: 'Christmas Hat', icon: '🎅', description: 'Add a cheerful red-and-white holiday hat.' },
    { id: 'halloween', name: 'Halloween Pumpkin', icon: '🎃', description: 'Add a friendly pumpkin decoration.' },
    { id: 'lunar', name: 'Lunar New Year Envelope', icon: '🧧', description: 'Add a bright red envelope for Lunar New Year.' }
  ];

  var els = {
    app: document.getElementById('petApp'),
    className: document.getElementById('className'),
    saveStatus: document.getElementById('saveStatus'),
    studentTotal: document.getElementById('studentTotal'),
    classPointsTotal: document.getElementById('classPointsTotal'),
    topStageTotal: document.getElementById('topStageTotal'),
    privacyToggle: document.getElementById('privacyToggle'),
    exportButton: document.getElementById('exportButton'),
    importButton: document.getElementById('importButton'),
    importFile: document.getElementById('importFile'),
    resetButton: document.getElementById('resetButton'),
    addStudentsForm: document.getElementById('addStudentsForm'),
    studentNames: document.getElementById('studentNames'),
    historyList: document.getElementById('historyList'),
    clearHistoryButton: document.getElementById('clearHistoryButton'),
    visibleCount: document.getElementById('visibleCount'),
    undoButton: document.getElementById('undoButton'),
    studentSearch: document.getElementById('studentSearch'),
    studentSort: document.getElementById('studentSort'),
    emptyState: document.getElementById('emptyState'),
    petGrid: document.getElementById('petGrid'),
    noResults: document.getElementById('noResults'),
    petPicker: document.getElementById('petPicker'),
    petPickerStudent: document.getElementById('petPickerStudent'),
    petPickerGrid: document.getElementById('petPickerGrid'),
    closePetPicker: document.getElementById('closePetPicker'),
    skinPicker: document.getElementById('skinPicker'),
    skinPickerStudent: document.getElementById('skinPickerStudent'),
    skinPickerGrid: document.getElementById('skinPickerGrid'),
    closeSkinPicker: document.getElementById('closeSkinPicker'),
    toast: document.getElementById('toast')
  };

  function newState() {
    return {
      version: BACKUP_VERSION,
      className: 'My Class',
      students: [],
      history: [],
      nextOrder: 1,
      settings: { sort: 'added', privateView: false },
      updatedAt: new Date().toISOString()
    };
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'student-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function cleanName(value, fallback) {
    var name = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return name || fallback || '';
  }

  function clampInteger(value, min, max) {
    var number = Math.round(Number(value));
    if (!Number.isFinite(number)) number = min;
    return Math.max(min, Math.min(max, number));
  }

  function normalizeState(candidate) {
    var normalized = newState();
    if (!candidate || typeof candidate !== 'object') return normalized;

    normalized.className = cleanName(candidate.className, 'My Class').slice(0, 60);
    normalized.settings.sort = ['added', 'name', 'points-high', 'points-low', 'stage'].indexOf(candidate.settings && candidate.settings.sort) !== -1
      ? candidate.settings.sort
      : 'added';
    normalized.settings.privateView = Boolean(candidate.settings && candidate.settings.privateView);

    var seenIds = Object.create(null);
    var rawStudents = Array.isArray(candidate.students) ? candidate.students.slice(0, MAX_STUDENTS) : [];
    normalized.students = rawStudents.map(function (student, index) {
      var id = cleanName(student && student.id, makeId());
      if (seenIds[id]) id = makeId();
      seenIds[id] = true;
      return {
        id: id,
        name: cleanName(student && student.name, 'Student ' + String(index + 1).padStart(2, '0')),
        points: clampInteger(student && student.points, 0, 99999),
        petIndex: clampInteger(student && student.petIndex, 0, PETS.length - 1),
        skin: SKINS.some(function (skin) { return skin.id === (student && student.skin); }) ? student.skin : 'none',
        order: clampInteger(student && student.order, 1, 999999)
      };
    });

    var maxOrder = normalized.students.reduce(function (max, student) { return Math.max(max, student.order); }, 0);
    normalized.nextOrder = Math.max(maxOrder + 1, clampInteger(candidate.nextOrder, 1, 999999));

    var validIds = Object.create(null);
    normalized.students.forEach(function (student) { validIds[student.id] = true; });
    var rawHistory = Array.isArray(candidate.history) ? candidate.history.slice(0, MAX_HISTORY) : [];
    normalized.history = rawHistory.map(function (event) {
      return {
        id: cleanName(event && event.id, makeId()),
        kind: 'points',
        studentId: cleanName(event && event.studentId),
        studentName: cleanName(event && event.studentName, 'Student'),
        before: clampInteger(event && event.before, 0, 99999),
        after: clampInteger(event && event.after, 0, 99999),
        delta: clampInteger(event && event.delta, -99999, 99999),
        at: event && !Number.isNaN(Date.parse(event.at)) ? event.at : new Date().toISOString(),
        active: Boolean(event && validIds[cleanName(event.studentId)])
      };
    });
    normalized.updatedAt = candidate.updatedAt && !Number.isNaN(Date.parse(candidate.updatedAt))
      ? candidate.updatedAt
      : new Date().toISOString();
    return normalized;
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : newState();
    } catch (error) {
      window.setTimeout(function () { showToast('Saved class data could not be read. A new class has been opened.'); }, 0);
      return newState();
    }
  }

  var state = loadState();

  function persist(message) {
    state.updatedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      els.saveStatus.textContent = 'Saved just now on this device';
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(function () {
        els.saveStatus.textContent = 'Saved on this device';
      }, 1800);
      if (message) showToast(message);
      return true;
    } catch (error) {
      els.saveStatus.textContent = 'Could not save in this browser';
      showToast('This browser blocked local saving. Export a backup before closing the page.');
      return false;
    }
  }

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { els.toast.classList.remove('visible'); }, 3000);
  }

  function stageFor(points) {
    for (var index = STAGES.length - 1; index >= 0; index -= 1) {
      if (points >= STAGES[index].min) return STAGES[index];
    }
    return STAGES[0];
  }

  function stageProgress(points, stage) {
    if (!stage.next) return 100;
    return Math.max(0, Math.min(100, ((points - stage.min) / (stage.next - stage.min)) * 100));
  }

  function studentById(id) {
    return state.students.find(function (student) { return student.id === id; });
  }

  function privateLabel(student) {
    var index = state.students.findIndex(function (item) { return item.id === student.id; });
    return 'Student ' + String(Math.max(0, index) + 1).padStart(2, '0');
  }

  function displayStudentName(student) {
    return state.settings.privateView ? privateLabel(student) : student.name;
  }

  function petStyle(node, pet) {
    var column = pet.cell % 3;
    var row = Math.floor(pet.cell / 3);
    node.style.setProperty('--pet-atlas', 'url("/images/class-pet-points/pet-atlas-0' + pet.atlas + '.webp")');
    node.style.setProperty('--pet-x', ['0%', '50%', '100%'][column]);
    node.style.setProperty('--pet-y', row === 0 ? '0%' : '100%');
  }

  function skinById(id) {
    return SKINS.find(function (skin) { return skin.id === id; }) || SKINS[0];
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text !== 'undefined') node.textContent = text;
    return node;
  }

  function actionButton(label, action, studentId, extraClass) {
    var button = element('button', extraClass || '', label);
    button.type = 'button';
    button.dataset.action = action;
    button.dataset.studentId = studentId;
    return button;
  }

  function buildStudentCard(student) {
    var pet = PETS[student.petIndex];
    var stage = stageFor(student.points);
    var card = element('article', 'student-card stage-' + stage.level);
    card.dataset.studentId = student.id;

    var header = element('div', 'student-card-header');
    var nameWrap = element('div', 'student-name-wrap');
    var name = element('h3', 'student-name');
    name.title = student.name;
    name.appendChild(element('span', 'real-name', student.name));
    name.appendChild(element('span', 'private-name', privateLabel(student)));
    nameWrap.appendChild(name);
    nameWrap.appendChild(element('p', 'pet-name', pet.name));

    var menu = element('details', 'student-menu');
    var summary = element('summary', '', '•••');
    summary.setAttribute('aria-label', 'Student options for ' + displayStudentName(student));
    var menuPanel = element('div', 'student-menu-panel');
    menuPanel.appendChild(actionButton('Rename', 'rename', student.id));
    menuPanel.appendChild(actionButton('Change pet', 'choose-pet', student.id));
    menuPanel.appendChild(actionButton('Holiday skin', 'choose-skin', student.id));
    menuPanel.appendChild(actionButton('Remove student', 'remove', student.id, 'remove-student'));
    menu.appendChild(summary);
    menu.appendChild(menuPanel);
    header.appendChild(nameWrap);
    header.appendChild(menu);
    card.appendChild(header);

    var visualButton = actionButton('', 'choose-pet', student.id, 'pet-visual-button');
    visualButton.setAttribute('aria-label', 'Change pet for ' + displayStudentName(student));
    var visual = element('div', 'pet-visual');
    visual.appendChild(element('span', 'egg-shell'));
    var sprite = element('span', 'pet-sprite');
    sprite.setAttribute('role', 'img');
    sprite.setAttribute('aria-label', pet.name + ', growth form ' + stage.level + ' of 6: ' + stage.name);
    petStyle(sprite, pet);
    visual.appendChild(sprite);
    if (student.skin !== 'none') {
      visual.appendChild(element('span', 'holiday-skin skin-' + student.skin));
    }
    visual.appendChild(element('span', 'pet-stage-decoration', stage.icon));
    visualButton.appendChild(visual);
    card.appendChild(visualButton);

    var copy = element('div', 'stage-copy');
    copy.appendChild(element('p', 'stage-label', 'Form ' + stage.level + ' of 6 · ' + stage.name));
    var pointsLine = element('p', 'points-line');
    pointsLine.appendChild(element('strong', '', String(student.points)));
    pointsLine.appendChild(document.createTextNode(' points'));
    copy.appendChild(pointsLine);
    if (student.skin !== 'none') copy.appendChild(element('p', 'skin-label', skinById(student.skin).name));
    card.appendChild(copy);

    var track = element('div', 'progress-track');
    var fill = element('div', 'progress-fill');
    fill.style.width = stageProgress(student.points, stage) + '%';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', 'Progress through ' + stage.name);
    track.setAttribute('aria-valuemin', String(stage.min));
    track.setAttribute('aria-valuenow', String(Math.min(student.points, stage.next || student.points)));
    track.setAttribute('aria-valuemax', String(stage.next || student.points));
    track.appendChild(fill);
    card.appendChild(track);
    var progressMessage;
    if (stage.level === 6) {
      progressMessage = student.points < 200
        ? (200 - student.points) + ' points to complete the sparkle milestone'
        : 'Sparkle milestone complete — holiday skins stay teacher-controlled!';
    } else {
      progressMessage = (stage.next - student.points) + ' points to ' + STAGES[stage.level].name;
    }
    card.appendChild(element('p', 'progress-note', progressMessage));

    var controls = element('div', 'point-controls');
    var minus = actionButton('−1', 'points', student.id, 'point-button minus');
    minus.dataset.delta = '-1';
    minus.setAttribute('aria-label', 'Remove 1 point from ' + displayStudentName(student));
    var plusOne = actionButton('+1', 'points', student.id, 'point-button plus-one');
    plusOne.dataset.delta = '1';
    plusOne.setAttribute('aria-label', 'Add 1 point to ' + displayStudentName(student));
    var plusFive = actionButton('+5', 'points', student.id, 'point-button plus-five');
    plusFive.dataset.delta = '5';
    plusFive.setAttribute('aria-label', 'Add 5 points to ' + displayStudentName(student));
    controls.appendChild(minus);
    controls.appendChild(plusOne);
    controls.appendChild(plusFive);
    card.appendChild(controls);

    return card;
  }

  function sortedStudents() {
    var students = state.students.slice();
    var sort = state.settings.sort;
    students.sort(function (a, b) {
      if (sort === 'name') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      if (sort === 'points-high') return b.points - a.points || a.name.localeCompare(b.name);
      if (sort === 'points-low') return a.points - b.points || a.name.localeCompare(b.name);
      if (sort === 'stage') return stageFor(b.points).level - stageFor(a.points).level || b.points - a.points;
      return b.order - a.order;
    });
    return students;
  }

  function matchingStudents() {
    var query = els.studentSearch.value.trim().toLocaleLowerCase();
    return sortedStudents().filter(function (student) {
      return !query || student.name.toLocaleLowerCase().indexOf(query) !== -1 || PETS[student.petIndex].name.toLocaleLowerCase().indexOf(query) !== -1;
    });
  }

  function renderSummary() {
    var classPoints = state.students.reduce(function (total, student) { return total + student.points; }, 0);
    var legends = state.students.filter(function (student) { return student.points >= 200; }).length;
    els.className.value = state.className;
    els.studentTotal.textContent = String(state.students.length);
    els.classPointsTotal.textContent = String(classPoints);
    els.topStageTotal.textContent = String(legends);
    els.studentSort.value = state.settings.sort;
    els.privacyToggle.setAttribute('aria-pressed', String(state.settings.privateView));
    els.privacyToggle.textContent = state.settings.privateView ? '◉ Privacy display on' : '◉ Privacy display';
    document.body.classList.toggle('privacy-view', state.settings.privateView);
  }

  function renderRoster() {
    var visible = matchingStudents();
    els.petGrid.replaceChildren();
    visible.forEach(function (student) { els.petGrid.appendChild(buildStudentCard(student)); });
    els.emptyState.hidden = state.students.length !== 0;
    els.petGrid.hidden = state.students.length === 0;
    els.noResults.hidden = state.students.length === 0 || visible.length !== 0;
    els.visibleCount.textContent = state.students.length ? '(' + visible.length + ' of ' + state.students.length + ')' : '';
    els.undoButton.disabled = !state.history.some(function (event) { return Boolean(studentById(event.studentId)); });
  }

  function friendlyTime(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    var seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (seconds < 45) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hr ago';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderHistory() {
    els.historyList.replaceChildren();
    var events = state.history.slice(0, 8);
    if (!events.length) {
      els.historyList.appendChild(element('p', 'history-empty', 'Point changes will appear here so you can review or undo them.'));
      return;
    }

    events.forEach(function (event) {
      var student = studentById(event.studentId);
      var row = element('div', 'history-item');
      row.appendChild(element('span', 'history-icon', event.delta >= 0 ? '✨' : '↩'));
      var copy = element('div', 'history-copy');
      copy.appendChild(element('strong', '', student ? displayStudentName(student) : event.studentName));
      copy.appendChild(element('small', '', event.before + ' → ' + event.after + ' · ' + friendlyTime(event.at)));
      row.appendChild(copy);
      row.appendChild(element('span', 'history-delta ' + (event.delta >= 0 ? 'positive' : 'negative'), (event.delta > 0 ? '+' : '') + event.delta));
      els.historyList.appendChild(row);
    });
  }

  function render() {
    renderSummary();
    renderRoster();
    renderHistory();
  }

  function choosePetIndex() {
    var counts = PETS.map(function () { return 0; });
    state.students.forEach(function (student) { counts[student.petIndex] += 1; });
    var lowest = Math.min.apply(Math, counts);
    var choices = counts.map(function (count, index) { return count === lowest ? index : -1; }).filter(function (index) { return index !== -1; });
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function addStudents(event) {
    event.preventDefault();
    var lines = els.studentNames.value.split(/\r?\n/).map(function (line) { return cleanName(line); }).filter(Boolean);
    if (!lines.length) {
      showToast('Add at least one nickname, initial, or student number.');
      els.studentNames.focus();
      return;
    }

    var known = Object.create(null);
    state.students.forEach(function (student) { known[student.name.toLocaleLowerCase()] = true; });
    var added = 0;
    var skipped = 0;
    lines.forEach(function (name) {
      var key = name.toLocaleLowerCase();
      if (known[key] || state.students.length >= MAX_STUDENTS) {
        skipped += 1;
        return;
      }
      known[key] = true;
      state.students.push({
        id: makeId(),
        name: name,
        points: 0,
        petIndex: choosePetIndex(),
        skin: 'none',
        order: state.nextOrder
      });
      state.nextOrder += 1;
      added += 1;
    });

    if (!added) {
      showToast(state.students.length >= MAX_STUDENTS ? 'This local class is limited to 60 students.' : 'Those students are already in the roster.');
      return;
    }
    els.studentNames.value = '';
    persist('Added ' + added + ' student' + (added === 1 ? '' : 's') + (skipped ? '; skipped ' + skipped + ' duplicate or extra entr' + (skipped === 1 ? 'y' : 'ies') + '.' : '.'));
    render();
  }

  function changePoints(studentId, requestedDelta) {
    var student = studentById(studentId);
    if (!student) return;
    var before = student.points;
    var after = Math.max(0, before + requestedDelta);
    var actualDelta = after - before;
    if (actualDelta === 0) {
      showToast(displayStudentName(student) + ' already has 0 points.');
      return;
    }
    var oldStage = stageFor(before);
    var nextStage = stageFor(after);
    student.points = after;
    state.history.unshift({
      id: makeId(),
      kind: 'points',
      studentId: student.id,
      studentName: student.name,
      before: before,
      after: after,
      delta: actualDelta,
      at: new Date().toISOString(),
      active: true
    });
    state.history = state.history.slice(0, MAX_HISTORY);
    var message = nextStage.level > oldStage.level
      ? displayStudentName(student) + "'s pet reached " + nextStage.name + '!'
      : before < 200 && after >= 200
        ? displayStudentName(student) + "'s pet completed the 200-point sparkle milestone!"
      : displayStudentName(student) + ' now has ' + after + ' points.';
    persist(message);
    render();
  }

  function undoLastChange() {
    while (state.history.length) {
      var event = state.history.shift();
      var student = studentById(event.studentId);
      if (!student) continue;
      student.points = event.before;
      persist('Undid the last points change for ' + displayStudentName(student) + '.');
      render();
      return;
    }
    render();
  }

  function renameStudent(studentId) {
    var student = studentById(studentId);
    if (!student) return;
    var proposed = window.prompt('Enter a new nickname, initial, or student number:', student.name);
    if (proposed === null) return;
    var name = cleanName(proposed);
    if (!name) {
      showToast('The student label cannot be empty.');
      return;
    }
    var duplicate = state.students.some(function (item) { return item.id !== student.id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase(); });
    if (duplicate) {
      showToast('That student label is already in the roster.');
      return;
    }
    student.name = name;
    state.history.forEach(function (event) { if (event.studentId === student.id) event.studentName = name; });
    persist('Updated the student label.');
    render();
  }

  function removeStudent(studentId) {
    var student = studentById(studentId);
    if (!student) return;
    if (!window.confirm('Remove ' + student.name + ' and their pet? This cannot be undone.')) return;
    state.students = state.students.filter(function (item) { return item.id !== studentId; });
    state.history = state.history.filter(function (event) { return event.studentId !== studentId; });
    persist('Removed ' + student.name + ' from the roster.');
    render();
  }

  function renderPetPicker() {
    els.petPickerGrid.replaceChildren();
    var student = studentById(pickerStudentId);
    if (!student) return;
    els.petPickerStudent.textContent = 'Choosing for ' + displayStudentName(student);
    PETS.forEach(function (pet, index) {
      var choice = element('button', 'pet-choice');
      choice.type = 'button';
      choice.dataset.petIndex = String(index);
      choice.setAttribute('aria-pressed', String(student.petIndex === index));
      var sprite = element('span', 'pet-choice-sprite');
      petStyle(sprite, pet);
      choice.appendChild(sprite);
      choice.appendChild(element('strong', '', pet.name));
      els.petPickerGrid.appendChild(choice);
    });
  }

  function openPetPicker(studentId) {
    if (!studentById(studentId)) return;
    pickerStudentId = studentId;
    renderPetPicker();
    if (typeof els.petPicker.showModal === 'function') els.petPicker.showModal();
    else els.petPicker.setAttribute('open', '');
  }

  function closePetPicker() {
    pickerStudentId = null;
    if (typeof els.petPicker.close === 'function') els.petPicker.close();
    else els.petPicker.removeAttribute('open');
  }

  function selectPet(index) {
    var student = studentById(pickerStudentId);
    if (!student || !PETS[index]) return;
    student.petIndex = index;
    var name = displayStudentName(student);
    persist(name + ' chose ' + PETS[index].name + '.');
    closePetPicker();
    render();
  }

  function renderSkinPicker() {
    els.skinPickerGrid.replaceChildren();
    var student = studentById(skinPickerStudentId);
    if (!student) return;
    els.skinPickerStudent.textContent = 'Choosing for ' + displayStudentName(student) + ' · ' + PETS[student.petIndex].name;
    SKINS.forEach(function (skin) {
      var choice = element('button', 'skin-choice');
      choice.type = 'button';
      choice.dataset.skinId = skin.id;
      choice.setAttribute('aria-pressed', String(student.skin === skin.id));
      choice.appendChild(element('span', 'skin-choice-icon', skin.icon));
      var copy = element('span', 'skin-choice-copy');
      copy.appendChild(element('strong', '', skin.name));
      copy.appendChild(element('small', '', skin.description));
      choice.appendChild(copy);
      els.skinPickerGrid.appendChild(choice);
    });
  }

  function openSkinPicker(studentId) {
    if (!studentById(studentId)) return;
    skinPickerStudentId = studentId;
    renderSkinPicker();
    if (typeof els.skinPicker.showModal === 'function') els.skinPicker.showModal();
    else els.skinPicker.setAttribute('open', '');
  }

  function closeSkinPicker() {
    skinPickerStudentId = null;
    if (typeof els.skinPicker.close === 'function') els.skinPicker.close();
    else els.skinPicker.removeAttribute('open');
  }

  function selectSkin(id) {
    var student = studentById(skinPickerStudentId);
    var skin = skinById(id);
    if (!student) return;
    student.skin = skin.id;
    var message = skin.id === 'none'
      ? 'Removed the holiday skin from ' + displayStudentName(student) + '.'
      : 'Added ' + skin.name + ' to ' + displayStudentName(student) + '.';
    persist(message);
    closeSkinPicker();
    render();
  }

  function exportBackup() {
    var payload = JSON.stringify(state, null, 2);
    var blob = new Blob([payload], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    var safeClassName = (state.className || 'class-pet-points').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'class-pet-points';
    link.href = url;
    link.download = safeClassName + '-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    showToast('Backup downloaded. Keep it somewhere safe.');
  }

  function importBackup(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var candidate = JSON.parse(String(reader.result || ''));
        if (!candidate || !Array.isArray(candidate.students)) throw new Error('Invalid backup');
        var imported = normalizeState(candidate);
        if (state.students.length && !window.confirm('Replace the current class with this backup?')) return;
        state = imported;
        els.studentSearch.value = '';
        persist('Imported ' + state.students.length + ' student' + (state.students.length === 1 ? '' : 's') + ' from the backup.');
        render();
      } catch (error) {
        showToast('That file is not a valid Class Pet Points backup.');
      } finally {
        els.importFile.value = '';
      }
    };
    reader.onerror = function () {
      showToast('The backup file could not be read.');
      els.importFile.value = '';
    };
    reader.readAsText(file);
  }

  function resetClass() {
    if (!state.students.length && !state.history.length) {
      showToast('The class is already empty.');
      return;
    }
    if (!window.confirm('Reset this class? All students, pets, points, and activity will be removed from this browser. Export a backup first if you may need it later.')) return;
    state = newState();
    els.studentSearch.value = '';
    els.studentNames.value = '';
    persist('The local class has been reset.');
    render();
  }

  function handleGridClick(event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var action = button.dataset.action;
    var studentId = button.dataset.studentId;
    var details = button.closest('details');
    if (details) details.open = false;
    if (action === 'points') changePoints(studentId, Number(button.dataset.delta));
    if (action === 'rename') renameStudent(studentId);
    if (action === 'remove') removeStudent(studentId);
    if (action === 'choose-pet') openPetPicker(studentId);
    if (action === 'choose-skin') openSkinPicker(studentId);
  }

  els.addStudentsForm.addEventListener('submit', addStudents);
  els.petGrid.addEventListener('click', handleGridClick);
  els.undoButton.addEventListener('click', undoLastChange);
  els.studentSearch.addEventListener('input', renderRoster);
  els.studentSort.addEventListener('change', function () {
    state.settings.sort = els.studentSort.value;
    persist();
    renderRoster();
  });
  els.className.addEventListener('input', function () {
    state.className = cleanName(els.className.value, 'My Class').slice(0, 60);
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () { persist(); }, 350);
  });
  els.className.addEventListener('blur', function () {
    state.className = cleanName(els.className.value, 'My Class').slice(0, 60);
    els.className.value = state.className;
    persist();
  });
  els.privacyToggle.addEventListener('click', function () {
    state.settings.privateView = !state.settings.privateView;
    persist(state.settings.privateView ? 'Privacy display is on.' : 'Privacy display is off.');
    render();
  });
  els.exportButton.addEventListener('click', exportBackup);
  els.importButton.addEventListener('click', function () { els.importFile.click(); });
  els.importFile.addEventListener('change', function () { importBackup(els.importFile.files && els.importFile.files[0]); });
  els.resetButton.addEventListener('click', resetClass);
  els.clearHistoryButton.addEventListener('click', function () {
    if (!state.history.length) return;
    state.history = [];
    persist('Recent activity was cleared.');
    renderHistory();
    renderRoster();
  });
  els.closePetPicker.addEventListener('click', closePetPicker);
  els.petPickerGrid.addEventListener('click', function (event) {
    var choice = event.target.closest('button[data-pet-index]');
    if (choice) selectPet(Number(choice.dataset.petIndex));
  });
  els.petPicker.addEventListener('click', function (event) {
    if (event.target === els.petPicker) closePetPicker();
  });
  els.petPicker.addEventListener('close', function () { pickerStudentId = null; });
  els.closeSkinPicker.addEventListener('click', closeSkinPicker);
  els.skinPickerGrid.addEventListener('click', function (event) {
    var choice = event.target.closest('button[data-skin-id]');
    if (choice) selectSkin(choice.dataset.skinId);
  });
  els.skinPicker.addEventListener('click', function (event) {
    if (event.target === els.skinPicker) closeSkinPicker();
  });
  els.skinPicker.addEventListener('close', function () { skinPickerStudentId = null; });
  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      state = normalizeState(JSON.parse(event.newValue));
      render();
      showToast('This class was updated in another tab.');
    } catch (error) {
      // Ignore malformed changes from another tab and keep the current valid state.
    }
  });

  render();
}());
