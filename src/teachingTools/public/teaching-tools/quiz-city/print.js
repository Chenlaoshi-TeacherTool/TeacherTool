(function() {
  'use strict';
  var model = window.QuizCityPrintModel;
  var tints = ['#fae2d7', '#def0e9', '#e9e3f8', '#fbf0c9'];
  function element(document, tag, content, className) {
    var item = document.createElement(tag);
    if (content !== undefined) item.textContent = content;
    if (className) item.className = className;
    return item;
  }
  function prepare(frame, config, cityArt) {
    return new Promise(function(resolve, reject) {
      frame.onload = async function() {
        try {
          var document = frame.contentDocument;
          var size = model.paper(config.paper);
          var boardHeight = size.height - 25;
          var language = config.lang === 'zh';
          var text = function(english, chinese) { return language ? chinese : english; };
          var sheets = [];
          var warnings = [];
          var style = element(document, 'style');
          style.textContent = '@page { size: ' + size.name + ' landscape; margin: 10mm; } :root { --page-width: ' + size.width + 'mm; --page-height: ' + size.height + 'mm; }';
          document.head.append(style);
          document.documentElement.lang = config.lang;
          document.title = 'CLS Quiz City - ' + text('Print classroom pack', '打印课堂包');
          function sheet(title, note) {
            var page = element(document, 'section', undefined, 'print-sheet');
            var heading = element(document, 'header', undefined, 'sheet-heading');
            heading.append(element(document, 'h1', title), element(document, 'p', note));
            var body = element(document, 'div', undefined, 'sheet-body');
            var footer = element(document, 'footer', undefined, 'sheet-footer');
            footer.append(element(document, 'span', 'CLS Teaching Tools · Quiz City'), element(document, 'span', undefined, 'page-number'));
            page.append(heading, body, footer); document.body.append(page); sheets.push(page);
            return { page: page, body: body, footer: footer };
          }
          function eventLabel(tile) {
            return (language ? tile.zh : tile.name) + ' · ' + (tile.type === 'building' ? text('Buy ', '购 ') + tile.price + text(' / Fee ', ' / 费 ') + tile.fee : { start: '+20', bonus: '+30', chance: '+35 / -15', penalty: '-25', challenge: text('extra Q +30', '加答 +30') }[tile.type]);
          }
          function board(items, boardIndex) {
            var grid = element(document, 'div', undefined, 'paper-board' + (config.layout === 'tiled' ? ' tiled' : ''));
            grid.style.setProperty('--board-height', (config.layout === 'tiled' ? boardHeight * 2 : boardHeight) + 'mm');
            var center = element(document, 'div', undefined, 'paper-center');
            var top = element(document, 'div', undefined, 'center-half');
            top.append(element(document, 'h2', 'CLS Quiz City'));
            if (cityArt) { var art = document.importNode(cityArt, true); art.removeAttribute('class'); top.append(art); }
            top.append(element(document, 'p', text('Start at 1 · Move clockwise · Answer the landing tile', '从第1格出发 · 顺时针行走 · 回答落脚格题目')));
            var bottom = element(document, 'div', undefined, 'center-half');
            bottom.append(element(document, 'h2', text('Roll. Answer. Build.', '掷骰 · 答题 · 建城')));
            bottom.append(element(document, 'p', text('Correct +20, then resolve the tile. Use a real die.', '答对 +20，然后处理格子事件。请自备骰子。')));
            bottom.append(element(document, 'p', config.minutes + text(' minutes · Finish the current round · Most assets wins', ' 分钟 · 完成当前整轮 · 总资产最高获胜')));
            var roster = element(document, 'div', undefined, 'roster');
            config.teams.forEach(function(name, index) { roster.append(element(document, 'span', (index + 1) + '. ' + name + ' · 200')); });
            bottom.append(roster, element(document, 'p', text('Keep the teacher answer key separate.', '教师答案页请单独保管。')));
            center.append(top, bottom); grid.append(center);
            items.forEach(function(item, index) {
              var tile = element(document, 'div', undefined, 'paper-tile ' + item.tile.type);
              var position = model.position(index); tile.style.gridColumn = position[0]; tile.style.gridRow = position[1];
              tile.dataset.tile = index + 1; tile.dataset.board = boardIndex + 1;
              var heading = element(document, 'h2'); heading.append(element(document, 'span', '#' + (index + 1) + (index === 0 ? ' →' : '')), element(document, 'span', 'Q' + item.questionNumber));
              var prompt = element(document, 'div', undefined, 'paper-prompt');
              var question = element(document, 'div', undefined, 'paper-question'); question.append(element(document, 'p', item.question.prompt));
              if (item.question.options.length) {
                var options = element(document, 'ol', undefined, 'paper-options');
                item.question.options.forEach(function(option, optionIndex) { options.append(element(document, 'li', String.fromCharCode(65 + optionIndex) + '. ' + option)); });
                question.append(options);
              }
              prompt.append(question); tile.append(heading, prompt, element(document, 'div', eventLabel(item.tile), 'paper-event')); grid.append(tile);
            });
            return grid;
          }
          var boards = model.boards(config.questions);
          boards.forEach(function(items, boardIndex) {
            var halves = config.layout === 'tiled' ? 2 : 1;
            for (var half = 0; half < halves; half++) {
              var note = text('Board ', '棋盘 ') + (boardIndex + 1) + (halves === 2 ? (half === 0 ? text(' · TOP HALF', ' · 上半张') : text(' · BOTTOM HALF', ' · 下半张')) : text(' · Compact', ' · 单页版'));
              var page = sheet('CLS Quiz City', note);
              var viewport = element(document, 'div', undefined, 'board-window' + (halves === 2 ? half === 0 ? ' join-top' : ' join-bottom' : ''));
              viewport.style.height = boardHeight + 'mm';
              var grid = board(items, boardIndex); grid.style.setProperty('--board-offset', -(half * boardHeight) + 'mm'); viewport.append(grid); page.body.append(viewport);
              page.footer.firstChild.textContent = halves === 2 ? text('Trim the dashed join edge; match the halves and tape. Print at 100%.', '裁去虚线拼接边外侧纸边，上下对齐粘贴；按100%打印。') : text('Print at 100% · Use the two-page board for longer questions.', '按100%打印 · 长题请选两页拼接版。');
            }
          });
          await document.fonts.ready;
          document.querySelectorAll('.paper-tile').forEach(function(tile) {
            var prompt = tile.querySelector('.paper-prompt'); var question = tile.querySelector('.paper-question');
            var font = config.layout === 'tiled' ? 12 : 10; var minimum = config.layout === 'tiled' ? 10 : 8.5;
            question.style.fontSize = font + 'pt';
            while (font > minimum && question.getBoundingClientRect().height > prompt.getBoundingClientRect().height + .5) { font -= .5; question.style.fontSize = font + 'pt'; }
            if (question.getBoundingClientRect().height > prompt.getBoundingClientRect().height + 1 || tile.scrollHeight > tile.clientHeight + 1) {
              tile.classList.add('overflow'); var label = text('Board ', '棋盘 ') + tile.dataset.board + ' #' + tile.dataset.tile;
              if (!warnings.includes(label)) warnings.push(label);
            }
          });
          if (config.key) {
            var answerPage;
            var answerList;
            function newAnswerPage() { answerPage = sheet(text('Teacher answer key', '教师答案页'), text('Q numbers match the board. Do not give to players.', 'Q题号与棋盘一致；请勿发给学生。')); answerList = element(document, 'div', undefined, 'paged-list'); answerPage.body.append(answerList); }
            newAnswerPage();
            config.questions.forEach(function(question, index) {
              var row = element(document, 'div', undefined, 'answer-row');
              var content = element(document, 'div'); content.append(element(document, 'p', question.prompt, 'key-prompt'), element(document, 'p', question.answer)); row.append(element(document, 'strong', 'Q' + (index + 1)), content); answerList.append(row);
              if (answerList.scrollHeight > answerList.clientHeight + 1) {
                row.remove();
                if (answerList.children.length) newAnswerPage();
                answerList.append(row);
                if (answerList.scrollHeight > answerList.clientHeight + 1) warnings.push(text('Answer Q', '答案 Q') + (index + 1));
              }
            });
          }
          if (config.kit) {
            var rulesPage = sheet(text('Quick rules & asset ledger', '游戏规则与资产记录'), config.minutes + text(' minutes · ', ' 分钟 · ') + config.teams.length + text(' teams', ' 队'));
            var rules = element(document, 'ol', undefined, 'rules');
            [text('Each team starts with 200 coins at tile 1. Use a real die and the cut-out numbered pawns. Move clockwise; wrap after tile 24.', '每队200金币，棋子放第1格。自备骰子，剪下编号棋子。顺时针行走，第24格后回第1格。'),
              text('Answer the question on the landing tile; a teacher or designated answer keeper checks the separate key. Correct +20; incorrect +0. Always resolve the tile next.', '回答落脚格的题目；由老师或指定答案保管员查看独立答案页判定。答对+20，答错+0；随后处理格子事件。'),
              text('Buildings: buy at the printed price or pass. Put your numbered ownership marker on a purchased building. Other teams pay the printed visit fee to its owner; pay no more than your available coins.', '建筑：可按标价购买，也可放弃。购入后放上本队编号所有权标记。其他队到访向房主支付参观费，最多扣除现有金币。'),
              text('Bonus +30. Repairs -25. Chance: roll again; 1-3 loses 15, 4-6 gains 35. Landing on Launch Plaza +20; passing it gives no bonus. Coins cannot fall below 0.', '奖励+30；维修-25。机会：再掷一次骰子，1～3扣15，4～6加35。停在启航广场+20，经过不加分。金币最低为0。'),
              text('Challenge: answer the next clockwise tile question as an extra question; correct +30, incorrect +0. Do not move or resolve that extra tile event.', '挑战：额外回答顺时针下一格的题目，答对+30，答错+0；不移动，也不触发额外格子的事件。'),
              text('Set a classroom timer. When time is up, finish the current round so every team has the same number of turns. Assets = coins + original purchase prices of owned buildings. Equal assets share a rank.', '设置课堂计时器。时间到后完成当前整轮，保证各队回合数相同。总资产=金币+所持建筑原购买价。资产相同则并列。'),
              text('Use one board per group. Q numbers refer to the shared answer key; repeated Q numbers reuse the same question. Track money with the ledger or optional coin counters.', '每组使用一张完整棋盘。Q题号对应共用答案页，同一Q题号表示重复题。可用记录表或金币纸片记录收支。')].forEach(function(rule) { rules.append(element(document, 'li', rule)); });
            rulesPage.body.append(rules);
            var ledger = element(document, 'table', undefined, 'ledger'); var headings = element(document, 'tr');
            [text('Team', '队伍'), text('Coins: start', '初始金币'), text('After turn 1', '回合1后'), text('After turn 2', '回合2后'), text('Final coins', '最终金币'), text('Buildings value', '建筑价值'), text('Total assets', '总资产')].forEach(function(label) { headings.append(element(document, 'th', label)); }); ledger.append(headings);
            config.teams.forEach(function(name, index) { var row = element(document, 'tr'); row.append(element(document, 'th', (index + 1) + '. ' + name)); ['200', '', '', '', '', ''].forEach(function(value) { row.append(element(document, 'td', value)); }); ledger.append(row); }); rulesPage.body.append(ledger);
            var cutouts = sheet(text('Cut-out playing pieces', '可剪游戏配件'), text('Cut dashed outlines. Team numbers work in black and white.', '沿虚线剪下；队伍编号支持黑白打印辨认。'));
            var pawns = element(document, 'div', undefined, 'pawn-row');
            config.teams.forEach(function(name, index) { var pawn = element(document, 'div', undefined, 'pawn'); pawn.style.setProperty('--team-tint', tints[index]); pawn.append(element(document, 'span', index + 1, 'pawn-disc'), element(document, 'span', name)); pawns.append(pawn); }); cutouts.body.append(pawns);
            cutouts.body.append(element(document, 'h2', text('Building ownership markers · 12 per team', '建筑所有权标记 · 每队12枚'), 'cut-title'));
            var markers = element(document, 'div', undefined, 'cut-grid');
            config.teams.forEach(function(name, index) { for (var count = 0; count < 12; count++) { var marker = element(document, 'div', text('TEAM ', '队 ') + (index + 1), 'owner-marker'); marker.style.setProperty('--team-tint', tints[index]); markers.append(marker); } }); cutouts.body.append(markers);
            cutouts.body.append(element(document, 'h2', text('Optional coins · use the ledger for larger amounts', '可选金币纸片 · 大额收支使用记录表'), 'cut-title'));
            var coins = element(document, 'div', undefined, 'coins-grid');
            [100, 100, 100, 100, 50, 50, 50, 50, 50, 50, 50, 50, 20, 20, 20, 20, 20, 20, 20, 20, 5, 5, 5, 5].forEach(function(value) { coins.append(element(document, 'span', value, 'paper-coin')); }); cutouts.body.append(coins);
          }
          sheets.forEach(function(page, index) {
            page.querySelector('.page-number').textContent = (index + 1) + ' / ' + sheets.length;
            var body = page.querySelector('.sheet-body');
            if (body.scrollHeight > body.clientHeight + 2) warnings.push(text('Page ', '第 ') + (index + 1) + text(' content', ' 页内容'));
          });
          resolve({ pages: sheets.length, boards: boards.length, repeats: boards.length * 24 - config.questions.length, warnings: warnings });
        } catch (error) { reject(error); }
      };
      frame.srcdoc = '<!doctype html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="/teaching-tools/quiz-city/print.css"></head><body></body></html>';
    });
  }
  window.QuizCityPrint = { prepare: prepare };
})();
