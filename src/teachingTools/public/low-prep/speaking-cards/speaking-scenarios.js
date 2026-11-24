/*
 * 口语任务卡 · Speaking Task Cards — built-in role-play situations.
 * Each situation: two roles (A and B) with a task, and sentence patterns
 * with hand-checked pinyin. "____" in a pattern is where a word goes.
 */
(function (global) {
  'use strict';

  global.SpeakingScenarios = [
    {
      key: 'restaurant', icon: '🍜', zh: '在饭馆点菜', en: 'Ordering at a restaurant',
      a: { role: '服务员', roleEn: 'Waiter', task: '问客人想吃什么、想喝什么，最后告诉他一共多少钱。', taskPy: 'Wèn kèrén xiǎng chī shénme, xiǎng hē shénme, zuìhòu gàosu tā yígòng duōshao qián.', taskEn: 'Ask what they would like to eat and drink, then tell them the total.' },
      b: { role: '客人', roleEn: 'Customer', task: '点一个菜和一个喝的，最后问一共多少钱。', taskPy: 'Diǎn yí gè cài hé yí gè hē de, zuìhòu wèn yígòng duōshao qián.', taskEn: 'Order one dish and one drink, then ask for the total.' },
      patterns: [
        { zh: '你想吃什么？', py: 'Nǐ xiǎng chī shénme?', en: 'What would you like to eat?' },
        { zh: '我要一碗____。', py: 'Wǒ yào yì wǎn ____.', en: 'I’d like a bowl of ____.' },
        { zh: '一共多少钱？', py: 'Yígòng duōshao qián?', en: 'How much is it altogether?' }
      ]
    },
    {
      key: 'shop', icon: '🛍️', zh: '在商店买东西', en: 'Shopping',
      a: { role: '售货员', roleEn: 'Shop assistant', task: '问客人想买什么，说价钱。客人讲价时，可以便宜一点。', taskPy: 'Wèn kèrén xiǎng mǎi shénme, shuō jiàqián. Kèrén jiǎngjià shí, kěyǐ piányi yìdiǎn.', taskEn: 'Ask what they want to buy and say the price. You may give a small discount.' },
      b: { role: '顾客', roleEn: 'Shopper', task: '说你想买什么，问价钱，试着讲价。', taskPy: 'Shuō nǐ xiǎng mǎi shénme, wèn jiàqián, shìzhe jiǎngjià.', taskEn: 'Say what you want, ask the price, and try to bargain.' },
      patterns: [
        { zh: '这个多少钱？', py: 'Zhège duōshao qián?', en: 'How much is this?' },
        { zh: '太贵了，便宜一点吧！', py: 'Tài guì le, piányi yìdiǎn ba!', en: 'Too expensive, a bit cheaper please!' },
        { zh: '我要两个____。', py: 'Wǒ yào liǎng gè ____.', en: 'I’ll take two ____.' }
      ]
    },
    {
      key: 'directions', icon: '🗺️', zh: '问路', en: 'Asking the way',
      a: { role: '问路的人', roleEn: 'Visitor', task: '你找不到一个地方，有礼貌地问路，最后说谢谢。', taskPy: 'Nǐ zhǎo bu dào yí gè dìfang, yǒu lǐmào de wèn lù, zuìhòu shuō xièxie.', taskEn: 'You are lost. Politely ask the way to a place and say thank you.' },
      b: { role: '本地人', roleEn: 'Local', task: '告诉他怎么走：往前、往左还是往右，远不远。', taskPy: 'Gàosu tā zěnme zǒu: wǎng qián, wǎng zuǒ háishi wǎng yòu, yuǎn bu yuǎn.', taskEn: 'Tell them how to get there: straight on, left or right, near or far.' },
      patterns: [
        { zh: '请问，____在哪儿？', py: 'Qǐngwèn, ____ zài nǎr?', en: 'Excuse me, where is ____?' },
        { zh: '一直往前走，然后往右拐。', py: 'Yìzhí wǎng qián zǒu, ránhòu wǎng yòu guǎi.', en: 'Go straight, then turn right.' },
        { zh: '不远，走五分钟就到了。', py: 'Bù yuǎn, zǒu wǔ fēnzhōng jiù dào le.', en: 'Not far, five minutes on foot.' }
      ]
    },
    {
      key: 'doctor', icon: '🏥', zh: '看医生', en: 'At the doctor’s',
      a: { role: '医生', roleEn: 'Doctor', task: '问病人哪儿不舒服、从什么时候开始，给他一个建议。', taskPy: 'Wèn bìngrén nǎr bù shūfu, cóng shénme shíhou kāishǐ, gěi tā yí gè jiànyì.', taskEn: 'Ask where it hurts and since when, then give some advice.' },
      b: { role: '病人', roleEn: 'Patient', task: '说你哪儿不舒服，从什么时候开始的。', taskPy: 'Shuō nǐ nǎr bù shūfu, cóng shénme shíhou kāishǐ de.', taskEn: 'Say what is wrong and when it started.' },
      patterns: [
        { zh: '你哪儿不舒服？', py: 'Nǐ nǎr bù shūfu?', en: 'What’s wrong?' },
        { zh: '我头疼，还有点儿发烧。', py: 'Wǒ tóu téng, hái yǒudiǎnr fāshāo.', en: 'I have a headache and a slight fever.' },
        { zh: '多喝水，好好休息。', py: 'Duō hē shuǐ, hǎohǎo xiūxi.', en: 'Drink lots of water and rest well.' }
      ]
    },
    {
      key: 'family', icon: '👨‍👩‍👧', zh: '介绍家人', en: 'Introducing your family',
      a: { role: '主人', roleEn: 'Host', task: '拿出一张家人的照片（可以画一张），介绍照片上的人。', taskPy: 'Náchū yì zhāng jiārén de zhàopiàn (kěyǐ huà yì zhāng), jièshào zhàopiàn shang de rén.', taskEn: 'Show a family photo (or draw one) and introduce the people in it.' },
      b: { role: '朋友', roleEn: 'Friend', task: '问照片上的人是谁、几岁、做什么工作。', taskPy: 'Wèn zhàopiàn shang de rén shì shéi, jǐ suì, zuò shénme gōngzuò.', taskEn: 'Ask who each person is, how old they are and what they do.' },
      patterns: [
        { zh: '这是我的____。', py: 'Zhè shì wǒ de ____.', en: 'This is my ____.' },
        { zh: '他是谁？他做什么工作？', py: 'Tā shì shéi? Tā zuò shénme gōngzuò?', en: 'Who is he? What does he do?' },
        { zh: '你家有几口人？', py: 'Nǐ jiā yǒu jǐ kǒu rén?', en: 'How many people are in your family?' }
      ]
    },
    {
      key: 'plans', icon: '📞', zh: '打电话约朋友', en: 'Making plans by phone',
      a: { role: '打电话的人', roleEn: 'Caller', task: '打电话约朋友这个周末一起做一件事。', taskPy: 'Dǎ diànhuà yuē péngyou zhège zhōumò yìqǐ zuò yí jiàn shì.', taskEn: 'Call a friend and invite them to do something this weekend.' },
      b: { role: '朋友', roleEn: 'Friend', task: '问什么时候、在哪儿见。可以答应，也可以说你没空。', taskPy: 'Wèn shénme shíhou, zài nǎr jiàn. Kěyǐ dāying, yě kěyǐ shuō nǐ méi kòng.', taskEn: 'Ask when and where. Say yes, or say you are busy.' },
      patterns: [
        { zh: '你这个周末有空吗？', py: 'Nǐ zhège zhōumò yǒu kòng ma?', en: 'Are you free this weekend?' },
        { zh: '我们一起去____吧！', py: 'Wǒmen yìqǐ qù ____ ba!', en: 'Let’s go to ____ together!' },
        { zh: '几点见？在哪儿见？', py: 'Jǐ diǎn jiàn? Zài nǎr jiàn?', en: 'What time and where shall we meet?' }
      ]
    },
    {
      key: 'borrow', icon: '✏️', zh: '借东西', en: 'Borrowing something',
      a: { role: '借东西的人', roleEn: 'Borrower', task: '有礼貌地借一样东西，说你要用来做什么，什么时候还。', taskPy: 'Yǒu lǐmào de jiè yí yàng dōngxi, shuō nǐ yào yònglái zuò shénme, shénme shíhou huán.', taskEn: 'Politely borrow something, say what it is for and when you will return it.' },
      b: { role: '同学', roleEn: 'Classmate', task: '借给他，或者告诉他为什么不行。', taskPy: 'Jiè gěi tā, huòzhě gàosu tā wèi shénme bù xíng.', taskEn: 'Lend it, or explain why you can’t.' },
      patterns: [
        { zh: '我可以借你的____吗？', py: 'Wǒ kěyǐ jiè nǐ de ____ ma?', en: 'Can I borrow your ____?' },
        { zh: '当然可以！给你。', py: 'Dāngrán kěyǐ! Gěi nǐ.', en: 'Of course! Here you go.' },
        { zh: '对不起，我也要用。', py: 'Duìbuqǐ, wǒ yě yào yòng.', en: 'Sorry, I need it too.' }
      ]
    },
    {
      key: 'meet', icon: '👋', zh: '认识新朋友', en: 'Meeting someone new',
      a: { role: '新同学', roleEn: 'New student', task: '介绍你自己：名字、几岁、从哪儿来、喜欢什么。', taskPy: 'Jièshào nǐ zìjǐ: míngzi, jǐ suì, cóng nǎr lái, xǐhuan shénme.', taskEn: 'Introduce yourself: name, age, where you are from, what you like.' },
      b: { role: '同学', roleEn: 'Classmate', task: '欢迎新同学，问他两个问题，也介绍你自己。', taskPy: 'Huānyíng xīn tóngxué, wèn tā liǎng gè wèntí, yě jièshào nǐ zìjǐ.', taskEn: 'Welcome them, ask two questions and introduce yourself too.' },
      patterns: [
        { zh: '你叫什么名字？', py: 'Nǐ jiào shénme míngzi?', en: 'What’s your name?' },
        { zh: '我今年____岁。', py: 'Wǒ jīnnián ____ suì.', en: 'I am ____ years old.' },
        { zh: '你喜欢做什么？', py: 'Nǐ xǐhuan zuò shénme?', en: 'What do you like to do?' }
      ]
    }
  ];

  // "Find someone who…" sentence frames. ____ is replaced by a word.
  global.SpeakingFrames = [
    { key: 'like', ask: '你喜欢____吗？', askPy: 'Nǐ xǐhuan ____ ma?', find: '喜欢____的同学', en: 'likes ____' },
    { key: 'have', ask: '你有____吗？', askPy: 'Nǐ yǒu ____ ma?', find: '有____的同学', en: 'has ____' },
    { key: 'can', ask: '你会____吗？', askPy: 'Nǐ huì ____ ma?', find: '会____的同学', en: 'can ____' },
    { key: 'been', ask: '你去过____吗？', askPy: 'Nǐ qùguo ____ ma?', find: '去过____的同学', en: 'has been to ____' },
    { key: 'eaten', ask: '你吃过____吗？', askPy: 'Nǐ chīguo ____ ma?', find: '吃过____的同学', en: 'has eaten ____' },
    { key: 'want', ask: '你想____吗？', askPy: 'Nǐ xiǎng ____ ma?', find: '想____的同学', en: 'wants to ____' }
  ];
})(window);
