'use strict';

(function (root, factory) {
  var game = factory();
  if (typeof module === 'object' && module.exports) module.exports = game;
  if (root && root.document) {
    root.document.addEventListener('DOMContentLoaded', function () {
      game.init(root.document, root.setTimeout.bind(root), root.clearTimeout.bind(root), root.localStorage);
    });
  }
})(typeof window !== 'undefined' ? window : null, function () {
  var STORAGE_KEY = 'teacherTool.witchsPoison.cardSets.v1';

  function parseCards(value) {
    return String(value || '').split(/\r?\n|\r/).map(function (line) {
      return line.trim();
    }).filter(Boolean);
  }

  function getTurn(cardIndex, groupCount) {
    return {
      cardNumber: cardIndex + 1,
      groupNumber: (cardIndex % groupCount) + 1
    };
  }

  function getTextClass(text) {
    var length = Array.from(text).length;
    if (length === 1) return 'is-single';
    if (length > 12) return 'is-long';
    return '';
  }

  // Backwards-compatible helper: enough cards for the poison cards alone.
  function canPlacePoisons(cardCount, groupCount, poisonsPerGroup) {
    return cardCount >= groupCount * poisonsPerGroup;
  }

  // Enough cards for every poison AND antidote card each group needs to hide.
  function canPlaceCards(cardCount, groupCount, poisonsPerGroup, antidotesPerGroup) {
    return cardCount >= groupCount * (poisonsPerGroup + Number(antidotesPerGroup || 0));
  }

  function makeGroups(groupCount) {
    var groups = [];
    for (var i = 0; i < groupCount; i += 1) {
      groups.push({ poisoned: false, antidotes: 0 });
    }
    return groups;
  }

  // Groups that are not currently poisoned.
  function getAliveCount(groups) {
    return groups.filter(function (g) { return !g.poisoned; }).length;
  }

  // A poisoned group still holding an antidote can come back, so the "last one
  // standing" ending must wait for them to decide.
  function canStillRecover(groups) {
    return groups.some(function (g) { return g.poisoned && g.antidotes > 0; });
  }

  function isGameOver(groups, flipped, total) {
    if (flipped >= total) return true;
    return getAliveCount(groups) <= 1 && !canStillRecover(groups);
  }

  // Next group (1-based) that is not poisoned, scanning forward from `current`
  // and wrapping around. Returns current if nobody else is available.
  function nextActiveGroup(current, groups) {
    var count = groups.length;
    for (var step = 1; step <= count; step += 1) {
      var candidate = ((current - 1 + step) % count) + 1;
      if (!groups[candidate - 1].poisoned) return candidate;
    }
    return current;
  }

  function getSavedCardSets(storage) {
    if (!storage) return [];
    try {
      return JSON.parse(storage.getItem(STORAGE_KEY) || '[]').filter(function (item) {
        return item && item.name && item.text;
      });
    } catch (_) {
      return [];
    }
  }

  function saveCardSet(storage, name, text) {
    var cleanName = String(name || '').trim();
    var cleanText = String(text || '').trim();
    if (!storage || !cleanName || !parseCards(cleanText).length) return null;
    var saved = getSavedCardSets(storage).filter(function (item) {
      return item.name !== cleanName;
    });
    var item = { name: cleanName, text: cleanText };
    saved.unshift(item);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(saved.slice(0, 30)));
      return item;
    } catch (_) {
      return null;
    }
  }

  function format(template, values) {
    return String(template || '').replace(/\{(\w+)\}/g, function (_, key) {
      return values[key] === undefined ? '' : values[key];
    });
  }

  function init(doc, schedule, cancelSchedule, storage) {
    var app = doc.getElementById('poison-app');
    if (!app) return;

    var form = doc.getElementById('poison-setup-form');
    var setup = doc.getElementById('poison-setup');
    var game = doc.getElementById('poison-game');
    var cardInput = doc.getElementById('poison-card-input');
    var cardCount = doc.getElementById('poison-card-count');
    var savedList = doc.getElementById('poison-saved-list');
    var saveName = doc.getElementById('poison-save-name');
    var saveButton = doc.getElementById('poison-save-cards');
    var loadButton = doc.getElementById('poison-load-cards');
    var groupInput = doc.getElementById('poison-group-count');
    var studentsInput = doc.getElementById('poison-students-per-group');
    var poisonInput = doc.getElementById('poison-cards-per-group');
    var antidoteInput = doc.getElementById('poison-antidote-toggle');
    var setupStatus = doc.getElementById('poison-setup-status');
    var defaultSetupStatus = setupStatus.textContent;
    var roster = doc.getElementById('poison-roster');
    var currentGroup = doc.getElementById('poison-current-group');
    var progress = doc.getElementById('poison-progress');
    var boardPrompt = doc.getElementById('poison-board-prompt');
    var cardGrid = doc.getElementById('poison-card-grid');
    var gameStatus = doc.getElementById('poison-game-status');
    var defaultGameStatus = gameStatus.textContent;
    var resetButton = doc.getElementById('poison-reset-button');
    var cast = doc.getElementById('poison-cast');
    var banner = doc.getElementById('poison-banner');
    var prefersReducedMotion = false;
    try {
      prefersReducedMotion = !!(root().matchMedia && root().matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) { prefersReducedMotion = false; }

    function root() { return typeof window !== 'undefined' ? window : {}; }

    var castTimer = null;
    var bannerTimer = null;

    function blankState() {
      return {
        cards: [],
        groupCount: 0,
        studentsPerGroup: 4,
        poisonsPerGroup: 1,
        antidotesPerGroup: 0,
        poisonCards: new Set(),
        antidoteCards: new Set(),
        groups: [],
        phase: 'setup',
        setupGroup: 1,
        setupPoisonPicks: 0,
        setupAntidotePicks: 0,
        turnGroup: 1,
        flipped: 0,
        ended: false,
        timer: null
      };
    }

    var state = blankState();

    function setSetupStatus(message, isError) {
      setupStatus.textContent = message;
      setupStatus.classList.toggle('is-error', Boolean(isError));
    }

    function renderSavedList(selectedName) {
      var saved = getSavedCardSets(storage);
      savedList.textContent = '';
      var emptyOption = doc.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = saved.length ? app.dataset.savedCardsPlaceholder : app.dataset.noSavedCards;
      savedList.appendChild(emptyOption);
      saved.forEach(function (item) {
        var option = doc.createElement('option');
        option.value = item.name;
        option.textContent = item.name;
        savedList.appendChild(option);
      });
      savedList.value = selectedName || '';
      loadButton.disabled = !saved.length;
    }

    function currentAntidotesPerGroup() {
      return antidoteInput && antidoteInput.checked ? 1 : 0;
    }

    function updateCardCount() {
      var cards = parseCards(cardInput.value);
      if (setupStatus.classList.contains('is-error')) setSetupStatus(defaultSetupStatus, false);
      cardCount.textContent = format(app.dataset.cardCountTemplate, { count: cards.length });
      var groupCount = Number(groupInput.value);
      var poisonsPerGroup = Number(poisonInput.value);
      var antidotesPerGroup = currentAntidotesPerGroup();
      var needed = groupCount * (poisonsPerGroup + antidotesPerGroup);
      var invalid = cards.length > 0 && Number.isInteger(groupCount) && Number.isInteger(poisonsPerGroup)
        && !canPlaceCards(cards.length, groupCount, poisonsPerGroup, antidotesPerGroup);
      poisonInput.setCustomValidity(invalid
        ? format(app.dataset.invalidPoisonCountTemplate, { count: cards.length, total: needed })
        : '');
    }

    // ----- Roster (team avatars) -------------------------------------------

    function renderRoster() {
      roster.textContent = '';
      state.groups.forEach(function (groupState, index) {
        var groupNumber = index + 1;
        var team = doc.createElement('div');
        team.className = 'poison-team';
        team.dataset.group = String(groupNumber);

        var avatar = doc.createElement('div');
        avatar.className = 'poison-team-avatar';
        var people = doc.createElement('div');
        people.className = 'poison-team-people';
        for (var p = 0; p < state.studentsPerGroup; p += 1) {
          var person = doc.createElement('span');
          person.className = 'poison-person';
          person.setAttribute('aria-hidden', 'true');
          person.textContent = '🧒';
          people.appendChild(person);
        }
        avatar.appendChild(people);

        var status = doc.createElement('span');
        status.className = 'poison-team-status';
        status.setAttribute('aria-hidden', 'true');
        avatar.appendChild(status);
        team.appendChild(avatar);

        var name = doc.createElement('p');
        name.className = 'poison-team-name';
        name.textContent = format(app.dataset.groupTemplate, { group: groupNumber });
        team.appendChild(name);

        var badges = doc.createElement('p');
        badges.className = 'poison-team-badges';
        team.appendChild(badges);

        var cure = doc.createElement('button');
        cure.type = 'button';
        cure.className = 'poison-team-cure';
        cure.dataset.group = String(groupNumber);
        cure.textContent = app.dataset.useAntidoteLabel;
        cure.hidden = true;
        team.appendChild(cure);

        roster.appendChild(team);
      });
      updateRoster();
    }

    function updateRoster() {
      Array.from(roster.querySelectorAll('.poison-team')).forEach(function (team) {
        var groupNumber = Number(team.dataset.group);
        var groupState = state.groups[groupNumber - 1];
        if (!groupState) return;
        var isCurrent = state.phase === 'play' && !state.ended && groupNumber === state.turnGroup;
        team.classList.toggle('is-poisoned', groupState.poisoned);
        team.classList.toggle('is-current', isCurrent);
        team.classList.toggle('has-antidote', groupState.antidotes > 0);

        var status = team.querySelector('.poison-team-status');
        status.textContent = groupState.poisoned ? '☠️' : '';

        var badges = team.querySelector('.poison-team-badges');
        badges.textContent = groupState.antidotes > 0
          ? format(app.dataset.antidoteHeldTemplate, { count: groupState.antidotes })
          : '';

        var cure = team.querySelector('.poison-team-cure');
        var canCure = groupState.poisoned && groupState.antidotes > 0 && !state.ended;
        cure.hidden = !canCure;
      });
    }

    // ----- Witch cast + banner animations ----------------------------------

    function witchAsset(kind) {
      return kind === 'antidote'
        ? { src: app.dataset.antidoteWitchSrc, emoji: '🧙‍♀️🧪', label: app.dataset.antidoteCastLabel }
        : { src: app.dataset.poisonWitchSrc, emoji: '🧙‍♀️🐈‍⬛', label: app.dataset.poisonCastLabel };
    }

    function playCast(kind, targetButton) {
      if (!cast) return;
      var asset = witchAsset(kind);
      cast.textContent = '';
      cast.className = 'poison-cast is-' + kind;
      cast.hidden = false;
      cast.setAttribute('aria-hidden', 'true');

      var figure = doc.createElement('div');
      figure.className = 'poison-cast-figure';

      var emoji = doc.createElement('span');
      emoji.className = 'poison-cast-emoji';
      emoji.textContent = asset.emoji;

      if (asset.src) {
        var img = doc.createElement('img');
        img.className = 'poison-cast-img';
        img.alt = '';
        img.src = asset.src;
        img.addEventListener('error', function () {
          img.remove();
          emoji.classList.add('is-visible');
        });
        figure.appendChild(img);
      } else {
        emoji.classList.add('is-visible');
      }
      figure.appendChild(emoji);

      var spark = doc.createElement('div');
      spark.className = 'poison-cast-spark';
      spark.textContent = kind === 'antidote' ? '✨' : '☠️';

      var label = doc.createElement('p');
      label.className = 'poison-cast-label';
      label.textContent = asset.label;

      cast.appendChild(figure);
      cast.appendChild(spark);
      cast.appendChild(label);

      if (targetButton && targetButton.classList) {
        targetButton.classList.add(kind === 'antidote' ? 'is-antidote-flash' : 'is-poison-flash');
      }

      if (castTimer !== null) cancelSchedule(castTimer);
      castTimer = schedule(function () {
        cast.hidden = true;
        cast.textContent = '';
        castTimer = null;
      }, prefersReducedMotion ? 500 : 1100);
    }

    function showBanner(kind, message, sub, onDone, holdMs) {
      if (!banner) { if (onDone) onDone(); return; }
      banner.textContent = '';
      banner.className = 'poison-banner is-' + kind;
      banner.hidden = false;
      banner.setAttribute('aria-hidden', 'false');

      var inner = doc.createElement('div');
      inner.className = 'poison-banner-inner';
      var title = doc.createElement('p');
      title.className = 'poison-banner-title';
      title.textContent = message;
      inner.appendChild(title);
      if (sub) {
        var subEl = doc.createElement('p');
        subEl.className = 'poison-banner-sub';
        subEl.textContent = sub;
        inner.appendChild(subEl);
      }
      banner.appendChild(inner);

      if (bannerTimer !== null) cancelSchedule(bannerTimer);
      var hold = holdMs || (prefersReducedMotion ? 900 : 1700);
      bannerTimer = schedule(function () {
        banner.hidden = true;
        banner.setAttribute('aria-hidden', 'true');
        banner.textContent = '';
        bannerTimer = null;
        if (onDone) onDone();
      }, hold);
    }

    // ----- Placement phase --------------------------------------------------

    function placingKind() {
      if (state.setupPoisonPicks < state.poisonsPerGroup) return 'poison';
      if (state.antidotesPerGroup > 0 && state.setupAntidotePicks < state.antidotesPerGroup) return 'antidote';
      return null;
    }

    function updatePlacementPrompt() {
      var kind = placingKind();
      currentGroup.textContent = format(app.dataset.groupTemplate, { group: state.setupGroup });
      if (kind === 'antidote') {
        progress.textContent = format(app.dataset.antidoteSetupProgressTemplate, {
          current: state.setupAntidotePicks,
          total: state.antidotesPerGroup
        });
        boardPrompt.textContent = format(app.dataset.antidoteSetupPromptTemplate, {
          group: state.setupGroup,
          total: state.antidotesPerGroup
        });
        boardPrompt.className = 'poison-read-prompt is-antidote-prompt';
      } else {
        progress.textContent = format(app.dataset.poisonSetupProgressTemplate, {
          current: state.setupPoisonPicks,
          total: state.poisonsPerGroup
        });
        boardPrompt.textContent = format(app.dataset.poisonSetupPromptTemplate, {
          group: state.setupGroup,
          total: state.poisonsPerGroup
        });
        boardPrompt.className = 'poison-read-prompt is-poison-prompt';
      }
    }

    function choosePlacementCard(cardButton) {
      var kind = placingKind();
      if (!kind) return;
      var cardNumber = Number(cardButton.dataset.cardNumber);
      cardButton.disabled = true;

      if (kind === 'antidote') {
        state.antidoteCards.add(cardNumber);
        state.setupAntidotePicks += 1;
        cardButton.classList.add('is-antidote-setup');
        cardButton.textContent = '💊';
      } else {
        state.poisonCards.add(cardNumber);
        state.setupPoisonPicks += 1;
        cardButton.classList.add('is-poison-setup');
        cardButton.textContent = '☠️';
      }
      playCast(kind, cardButton);

      if (placingKind()) {
        updatePlacementPrompt();
        return;
      }

      if (state.setupGroup < state.groupCount) {
        state.setupGroup += 1;
        state.setupPoisonPicks = 0;
        state.setupAntidotePicks = 0;
        updatePlacementPrompt();
        return;
      }

      finishPlacement();
    }

    function finishPlacement() {
      boardPrompt.textContent = '';
      Array.from(cardGrid.querySelectorAll('button')).forEach(function (button) {
        button.disabled = true;
      });
      showBanner('start', app.dataset.gameStartTitle, app.dataset.gameStartSub, startPlay);
    }

    // ----- Play phase -------------------------------------------------------

    function startPlay() {
      state.phase = 'play';
      state.flipped = 0;
      state.turnGroup = 1;
      state.ended = false;
      Array.from(cardGrid.querySelectorAll('button')).forEach(function (button) {
        button.disabled = false;
        button.classList.remove('is-poison-setup', 'is-antidote-setup');
        // Restore the original card text hidden during placement.
        var index = Number(button.dataset.cardNumber) - 1;
        button.textContent = state.cards[index];
      });
      boardPrompt.className = 'poison-read-prompt';
      boardPrompt.textContent = app.dataset.playPrompt;
      gameStatus.textContent = defaultGameStatus;
      gameStatus.classList.remove('is-ended');
      updateTurn();
    }

    function updateProgress() {
      progress.textContent = format(app.dataset.progressTemplate, {
        current: state.flipped,
        total: state.cards.length
      });
    }

    function updateTurn() {
      currentGroup.textContent = format(app.dataset.groupTemplate, { group: state.turnGroup });
      updateProgress();
      updateRoster();
    }

    function advanceTurn() {
      state.turnGroup = nextActiveGroup(state.turnGroup, state.groups);
      updateTurn();
    }

    function survivorList() {
      var survivors = [];
      state.groups.forEach(function (g, index) {
        if (!g.poisoned) survivors.push(index + 1);
      });
      return survivors;
    }

    function endGame() {
      state.ended = true;
      Array.from(cardGrid.querySelectorAll('button')).forEach(function (button) {
        button.disabled = true;
      });
      updateRoster();
      var survivors = survivorList();
      var title;
      var sub;
      if (survivors.length === 1) {
        title = app.dataset.gameOverWinTitle;
        sub = format(app.dataset.gameOverWinSub, { group: survivors[0] });
      } else if (survivors.length === 0) {
        title = app.dataset.gameOverTitle;
        sub = app.dataset.gameOverAllPoisoned;
      } else {
        title = app.dataset.gameOverTitle;
        sub = format(app.dataset.gameOverSurvivors, {
          groups: survivors.map(function (n) {
            return format(app.dataset.groupTemplate, { group: n });
          }).join('、')
        });
      }
      gameStatus.textContent = sub;
      gameStatus.classList.add('is-ended');
      showBanner('over', title, sub, function () { resetButton.focus(); }, prefersReducedMotion ? 1000 : 2400);
    }

    function checkGameOver() {
      if (isGameOver(state.groups, state.flipped, state.cards.length)) {
        endGame();
        return true;
      }
      return false;
    }

    function chooseCard(event) {
      var cardButton = event.target.closest('button');
      if (!cardButton || state.ended || cardButton.disabled) return;

      if (state.phase === 'poison-setup') {
        choosePlacementCard(cardButton);
        return;
      }
      if (state.phase !== 'play') return;

      var cardNumber = Number(cardButton.dataset.cardNumber);
      var groupState = state.groups[state.turnGroup - 1];
      cardButton.disabled = true;
      state.flipped += 1;

      if (state.antidoteCards.has(cardNumber)) {
        cardButton.classList.add('is-antidote-found');
        groupState.antidotes += 1;
        playCast('antidote', cardButton);
        gameStatus.textContent = format(app.dataset.antidoteFoundTemplate, { group: state.turnGroup });
      } else if (state.poisonCards.has(cardNumber)) {
        cardButton.classList.add('is-poisoned');
        groupState.poisoned = true;
        playCast('poison', cardButton);
        gameStatus.textContent = format(app.dataset.poisonGroupTemplate, { group: state.turnGroup });
      } else {
        cardButton.classList.add('is-safe');
        gameStatus.textContent = defaultGameStatus;
      }

      updateProgress();
      updateRoster();
      if (checkGameOver()) return;
      advanceTurn();
    }

    function useAntidote(groupNumber) {
      var groupState = state.groups[groupNumber - 1];
      if (!groupState || !groupState.poisoned || groupState.antidotes <= 0 || state.ended) return;
      groupState.antidotes -= 1;
      groupState.poisoned = false;
      playCast('antidote');
      gameStatus.textContent = format(app.dataset.antidoteUsedTemplate, { group: groupNumber });
      // Make sure the turn pointer rests on an active group again.
      if (state.groups[state.turnGroup - 1] && state.groups[state.turnGroup - 1].poisoned) {
        state.turnGroup = nextActiveGroup(state.turnGroup, state.groups);
      }
      updateTurn();
      checkGameOver();
    }

    // ----- Board render + reset --------------------------------------------

    function renderBoard() {
      cardGrid.textContent = '';
      state.cards.forEach(function (text, index) {
        var button = doc.createElement('button');
        var textClass = getTextClass(text);
        button.type = 'button';
        button.className = 'poison-grid-card' + (textClass ? ' ' + textClass : '');
        button.dataset.cardNumber = index + 1;
        button.textContent = text;
        cardGrid.appendChild(button);
      });
      updatePlacementPrompt();
    }

    function resetGame() {
      if (state.timer !== null) cancelSchedule(state.timer);
      if (castTimer !== null) { cancelSchedule(castTimer); castTimer = null; }
      if (bannerTimer !== null) { cancelSchedule(bannerTimer); bannerTimer = null; }
      state = blankState();
      if (cast) { cast.hidden = true; cast.textContent = ''; }
      if (banner) { banner.hidden = true; banner.textContent = ''; }
      roster.textContent = '';
      game.hidden = true;
      setup.hidden = false;
      cardGrid.textContent = '';
      boardPrompt.className = 'poison-read-prompt';
      boardPrompt.textContent = app.dataset.playPrompt;
      gameStatus.textContent = defaultGameStatus;
      gameStatus.classList.remove('is-ended');
      setSetupStatus(defaultSetupStatus, false);
      form.querySelector('button[type="submit"]').focus();
    }

    // ----- Wire up ----------------------------------------------------------

    cardInput.addEventListener('input', updateCardCount);
    poisonInput.addEventListener('input', updateCardCount);
    groupInput.addEventListener('input', updateCardCount);
    if (antidoteInput) antidoteInput.addEventListener('change', updateCardCount);

    saveButton.addEventListener('click', function () {
      var saved = saveCardSet(storage, saveName.value, cardInput.value);
      if (!saved) {
        setSetupStatus(saveName.value.trim() ? app.dataset.invalidCards : app.dataset.saveMissingName, true);
        return;
      }
      renderSavedList(saved.name);
      setSetupStatus(format(app.dataset.saveSuccessTemplate, { name: saved.name }), false);
    });

    loadButton.addEventListener('click', function () {
      var selected = savedList.value;
      var item = getSavedCardSets(storage).find(function (saved) { return saved.name === selected; });
      if (!item) return;
      cardInput.value = item.text;
      saveName.value = item.name;
      updateCardCount();
      setSetupStatus(format(app.dataset.loadSuccessTemplate, { name: item.name }), false);
      cardInput.focus();
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var cards = parseCards(cardInput.value);
      if (!cards.length) {
        setSetupStatus(app.dataset.invalidCards, true);
        cardInput.focus();
        return;
      }

      var groupCount = Number(groupInput.value);
      var studentsPerGroup = Number(studentsInput.value);
      var poisonsPerGroup = Number(poisonInput.value);
      var antidotesPerGroup = currentAntidotesPerGroup();

      if (!Number.isInteger(groupCount) || groupCount < 1) {
        setSetupStatus(app.dataset.invalidGroups, true);
        groupInput.focus();
        return;
      }
      if (!Number.isInteger(studentsPerGroup) || studentsPerGroup < 1) {
        studentsPerGroup = 1;
      }
      if (!Number.isInteger(poisonsPerGroup) || poisonsPerGroup < 1
        || !canPlaceCards(cards.length, groupCount, poisonsPerGroup, antidotesPerGroup)) {
        setSetupStatus(format(app.dataset.invalidPoisonCountTemplate, {
          count: cards.length,
          total: groupCount * (poisonsPerGroup + antidotesPerGroup)
        }), true);
        poisonInput.focus();
        return;
      }

      state = blankState();
      state.cards = cards;
      state.groupCount = groupCount;
      state.studentsPerGroup = studentsPerGroup;
      state.poisonsPerGroup = poisonsPerGroup;
      state.antidotesPerGroup = antidotesPerGroup;
      state.groups = makeGroups(groupCount);
      state.phase = 'poison-setup';
      state.setupGroup = 1;
      state.setupPoisonPicks = 0;
      state.setupAntidotePicks = 0;

      setup.hidden = true;
      game.hidden = false;
      gameStatus.textContent = '';
      gameStatus.classList.remove('is-ended');
      renderRoster();
      renderBoard();
      var firstCard = cardGrid.querySelector('button');
      if (firstCard) firstCard.focus();
    });

    cardGrid.addEventListener('click', chooseCard);
    roster.addEventListener('click', function (event) {
      var cureButton = event.target.closest('.poison-team-cure');
      if (!cureButton) return;
      useAntidote(Number(cureButton.dataset.group));
    });
    resetButton.addEventListener('click', resetGame);
    renderSavedList();
    updateCardCount();
  }

  return {
    parseCards: parseCards,
    getTurn: getTurn,
    getTextClass: getTextClass,
    canPlacePoisons: canPlacePoisons,
    canPlaceCards: canPlaceCards,
    makeGroups: makeGroups,
    getAliveCount: getAliveCount,
    canStillRecover: canStillRecover,
    isGameOver: isGameOver,
    nextActiveGroup: nextActiveGroup,
    getSavedCardSets: getSavedCardSets,
    saveCardSet: saveCardSet,
    init: init
  };
});
