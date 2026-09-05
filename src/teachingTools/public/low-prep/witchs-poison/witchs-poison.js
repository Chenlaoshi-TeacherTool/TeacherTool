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

  function canPlacePoisons(cardCount, groupCount, poisonsPerGroup) {
    return cardCount >= groupCount * poisonsPerGroup;
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
    return template.replace(/\{(\w+)\}/g, function (_, key) {
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
    var poisonInput = doc.getElementById('poison-cards-per-group');
    var setupStatus = doc.getElementById('poison-setup-status');
    var defaultSetupStatus = setupStatus.textContent;
    var currentGroup = doc.getElementById('poison-current-group');
    var progress = doc.getElementById('poison-progress');
    var boardPrompt = doc.getElementById('poison-board-prompt');
    var cardGrid = doc.getElementById('poison-card-grid');
    var gameStatus = doc.getElementById('poison-game-status');
    var defaultGameStatus = gameStatus.textContent;
    var resetButton = doc.getElementById('poison-reset-button');
    var alert = doc.getElementById('poison-alert');
    var alertGroup = doc.getElementById('poison-alert-group');
    var state = {
      cards: [],
      groupCount: 0,
      poisonsPerGroup: 1,
      poisonCards: new Set(),
      phase: 'play',
      setupGroup: 1,
      setupPicks: 0,
      picks: 0,
      ended: false,
      timer: null
    };

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

    function updateCardCount() {
      var cards = parseCards(cardInput.value);
      if (setupStatus.classList.contains('is-error')) setSetupStatus(defaultSetupStatus, false);
      cardCount.textContent = format(app.dataset.cardCountTemplate, { count: cards.length });
      var groupCount = Number(groupInput.value);
      var poisonsPerGroup = Number(poisonInput.value);
      var invalid = cards.length > 0 && Number.isInteger(groupCount) && Number.isInteger(poisonsPerGroup)
        && !canPlacePoisons(cards.length, groupCount, poisonsPerGroup);
      poisonInput.setCustomValidity(invalid
        ? format(app.dataset.invalidPoisonCountTemplate, { count: cards.length, total: groupCount * poisonsPerGroup })
        : '');
    }

    function updateTurn() {
      var turn = getTurn(state.picks, state.groupCount);
      currentGroup.textContent = format(app.dataset.groupTemplate, { group: turn.groupNumber });
      progress.textContent = format(app.dataset.progressTemplate, { current: state.picks, total: state.cards.length });
    }

    function updatePoisonSetupTurn() {
      currentGroup.textContent = format(app.dataset.groupTemplate, { group: state.setupGroup });
      progress.textContent = format(app.dataset.poisonSetupProgressTemplate, {
        current: state.setupPicks,
        total: state.poisonsPerGroup
      });
      boardPrompt.textContent = format(app.dataset.poisonSetupPromptTemplate, {
        group: state.setupGroup,
        total: state.poisonsPerGroup
      });
    }

    function startPlay() {
      state.phase = 'play';
      state.picks = 0;
      Array.from(cardGrid.querySelectorAll('button')).forEach(function (button) {
        button.disabled = false;
        button.classList.remove('is-poison-setup');
      });
      boardPrompt.textContent = app.dataset.playPrompt;
      gameStatus.textContent = defaultGameStatus;
      updateTurn();
    }

    function showPoison(turn, cardButton) {
      state.ended = true;
      Array.from(cardGrid.querySelectorAll('button')).forEach(function (button) {
        button.disabled = true;
      });
      cardButton.classList.add('is-poisoned');
      alertGroup.textContent = format(app.dataset.poisonGroupTemplate, { group: turn.groupNumber });
      alert.hidden = false;
      alert.setAttribute('aria-hidden', 'false');
      state.timer = schedule(function () {
        alert.hidden = true;
        alert.setAttribute('aria-hidden', 'true');
        gameStatus.textContent = format(app.dataset.gameOverTemplate, { group: turn.groupNumber });
        gameStatus.classList.add('is-ended');
        resetButton.focus();
      }, 1800);
    }

    function choosePoisonCard(cardButton) {
      var cardNumber = Number(cardButton.dataset.cardNumber);
      state.poisonCards.add(cardNumber);
      state.setupPicks += 1;
      cardButton.disabled = true;
      cardButton.classList.add('is-poison-setup');

      if (state.setupPicks < state.poisonsPerGroup) {
        updatePoisonSetupTurn();
        return;
      }

      if (state.setupGroup < state.groupCount) {
        state.setupGroup += 1;
        state.setupPicks = 0;
        updatePoisonSetupTurn();
        return;
      }

      startPlay();
    }

    function chooseCard(event) {
      var cardButton = event.target.closest('button');
      if (!cardButton || state.ended || cardButton.disabled) return;
      if (state.phase === 'poison-setup') {
        choosePoisonCard(cardButton);
        return;
      }

      var cardNumber = Number(cardButton.dataset.cardNumber);
      var turn = getTurn(state.picks, state.groupCount);
      if (state.poisonCards.has(cardNumber)) {
        showPoison(turn, cardButton);
        return;
      }

      cardButton.disabled = true;
      cardButton.classList.add('is-safe');
      state.picks += 1;
      updateTurn();
      gameStatus.textContent = defaultGameStatus;
    }

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
      updatePoisonSetupTurn();
    }

    function resetGame() {
      if (state.timer !== null) cancelSchedule(state.timer);
      state = {
        cards: [],
        groupCount: 0,
        poisonsPerGroup: 1,
        poisonCards: new Set(),
        phase: 'play',
        setupGroup: 1,
        setupPicks: 0,
        picks: 0,
        ended: false,
        timer: null
      };
      alert.hidden = true;
      alert.setAttribute('aria-hidden', 'true');
      game.hidden = true;
      setup.hidden = false;
      cardGrid.textContent = '';
      boardPrompt.textContent = app.dataset.playPrompt;
      gameStatus.classList.remove('is-ended');
      setSetupStatus(defaultSetupStatus, false);
      form.querySelector('button[type="submit"]').focus();
    }

    cardInput.addEventListener('input', updateCardCount);
    poisonInput.addEventListener('input', updateCardCount);
    groupInput.addEventListener('input', updateCardCount);

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
      var poisonsPerGroup = Number(poisonInput.value);
      if (!Number.isInteger(poisonsPerGroup) || poisonsPerGroup < 1 || !canPlacePoisons(cards.length, groupCount, poisonsPerGroup)) {
        setSetupStatus(format(app.dataset.invalidPoisonCountTemplate, { count: cards.length, total: groupCount * poisonsPerGroup }), true);
        poisonInput.focus();
        return;
      }

      state.cards = cards;
      state.groupCount = groupCount;
      state.poisonsPerGroup = poisonsPerGroup;
      state.poisonCards = new Set();
      state.phase = 'poison-setup';
      state.setupGroup = 1;
      state.setupPicks = 0;
      state.picks = 0;
      state.ended = false;
      setup.hidden = true;
      game.hidden = false;
      gameStatus.textContent = '';
      gameStatus.classList.remove('is-ended');
      renderBoard();
      cardGrid.querySelector('button').focus();
    });

    cardGrid.addEventListener('click', chooseCard);
    resetButton.addEventListener('click', resetGame);
    renderSavedList();
    updateCardCount();
  }

  return {
    parseCards: parseCards,
    getTurn: getTurn,
    getTextClass: getTextClass,
    canPlacePoisons: canPlacePoisons,
    getSavedCardSets: getSavedCardSets,
    saveCardSet: saveCardSet,
    init: init
  };
});
