'use strict';

(function (root, factory) {
  var game = factory();
  if (typeof module === 'object' && module.exports) module.exports = game;
  if (root && root.document) {
    root.document.addEventListener('DOMContentLoaded', function () {
      game.init(root.document, root.setTimeout.bind(root), root.clearTimeout.bind(root));
    });
  }
})(typeof window !== 'undefined' ? window : null, function () {
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

  function format(template, values) {
    return template.replace(/\{(\w+)\}/g, function (_, key) {
      return values[key] === undefined ? '' : values[key];
    });
  }

  function init(doc, schedule, cancelSchedule) {
    var app = doc.getElementById('poison-app');
    if (!app) return;

    var form = doc.getElementById('poison-setup-form');
    var setup = doc.getElementById('poison-setup');
    var game = doc.getElementById('poison-game');
    var cardInput = doc.getElementById('poison-card-input');
    var cardCount = doc.getElementById('poison-card-count');
    var groupInput = doc.getElementById('poison-group-count');
    var poisonInput = doc.getElementById('poison-card-number');
    var setupStatus = doc.getElementById('poison-setup-status');
    var defaultSetupStatus = setupStatus.textContent;
    var currentGroup = doc.getElementById('poison-current-group');
    var progress = doc.getElementById('poison-progress');
    var readingCard = doc.getElementById('poison-reading-card');
    var cardContent = doc.getElementById('poison-card-content');
    var gameStatus = doc.getElementById('poison-game-status');
    var nextButton = doc.getElementById('poison-next-button');
    var resetButton = doc.getElementById('poison-reset-button');
    var alert = doc.getElementById('poison-alert');
    var alertGroup = doc.getElementById('poison-alert-group');
    var state = { cards: [], groupCount: 0, poisonNumber: 0, cardIndex: 0, ended: false, timer: null };

    function setSetupStatus(message, isError) {
      setupStatus.textContent = message;
      setupStatus.classList.toggle('is-error', Boolean(isError));
    }

    function updateCardCount() {
      var cards = parseCards(cardInput.value);
      if (setupStatus.classList.contains('is-error')) setSetupStatus(defaultSetupStatus, false);
      cardCount.textContent = format(app.dataset.cardCountTemplate, { count: cards.length });
      poisonInput.max = Math.max(cards.length, 1);
      var poisonNumber = Number(poisonInput.value);
      var invalid = cards.length > 0 && poisonNumber > cards.length;
      poisonInput.setCustomValidity(invalid
        ? format(app.dataset.invalidPoisonTemplate, { count: cards.length })
        : '');
    }

    function showPoison(turn) {
      state.ended = true;
      nextButton.disabled = true;
      readingCard.classList.add('is-poisoned');
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

    function showCurrentCard() {
      var turn = getTurn(state.cardIndex, state.groupCount);
      var text = state.cards[state.cardIndex];
      var length = Array.from(text).length;

      currentGroup.textContent = format(app.dataset.groupTemplate, { group: turn.groupNumber });
      progress.textContent = format(app.dataset.progressTemplate, { current: turn.cardNumber, total: state.cards.length });
      cardContent.textContent = text;
      cardContent.classList.toggle('is-single', length === 1);
      cardContent.classList.toggle('is-long', length > 12);
      readingCard.classList.remove('is-poisoned');

      if (turn.cardNumber === state.poisonNumber) showPoison(turn);
    }

    function resetGame() {
      if (state.timer !== null) cancelSchedule(state.timer);
      state = { cards: [], groupCount: 0, poisonNumber: 0, cardIndex: 0, ended: false, timer: null };
      alert.hidden = true;
      alert.setAttribute('aria-hidden', 'true');
      game.hidden = true;
      setup.hidden = false;
      nextButton.disabled = false;
      readingCard.classList.remove('is-poisoned');
      gameStatus.classList.remove('is-ended');
      setSetupStatus(defaultSetupStatus, false);
      form.querySelector('button[type="submit"]').focus();
    }

    cardInput.addEventListener('input', updateCardCount);
    poisonInput.addEventListener('input', updateCardCount);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var cards = parseCards(cardInput.value);
      if (!cards.length) {
        setSetupStatus(app.dataset.invalidCards, true);
        cardInput.focus();
        return;
      }

      var poisonNumber = Number(poisonInput.value);
      if (!Number.isInteger(poisonNumber) || poisonNumber < 1 || poisonNumber > cards.length) {
        setSetupStatus(format(app.dataset.invalidPoisonTemplate, { count: cards.length }), true);
        poisonInput.focus();
        return;
      }

      state.cards = cards;
      state.groupCount = Number(groupInput.value);
      state.poisonNumber = poisonNumber;
      state.cardIndex = 0;
      state.ended = false;
      setup.hidden = true;
      game.hidden = false;
      gameStatus.textContent = '';
      gameStatus.classList.remove('is-ended');
      nextButton.disabled = false;
      showCurrentCard();
      if (!state.ended) nextButton.focus();
    });

    nextButton.addEventListener('click', function () {
      if (state.ended) return;
      state.cardIndex += 1;
      showCurrentCard();
    });

    resetButton.addEventListener('click', resetGame);
    updateCardCount();
  }

  return {
    parseCards: parseCards,
    getTurn: getTurn,
    init: init
  };
});
