'use strict';

// Editorial selections for language classrooms; numbers are display order, not sales ranks.
var AFFILIATE_TAG = 'chenlaoshitea-20';

module.exports = [
  {
    "image": "https://images-na.ssl-images-amazon.com/images/I/71QH-5od8zL.jpg",
    "query": "blank mini dry erase lap boards classroom set",
    "en": {
      "title": "Mini whiteboards",
      "blurb": "Dictate a word or sentence, then have everyone show an answer together. Choose a blank surface for characters, accents, or quick sketches."
    },
    "zh": {
      "title": "听写与即时反馈小白板",
      "blurb": "听写词语、汉字或短句，全班同时举板作答，快速查看理解情况。优先选空白板面，方便写不同文字或画图。"
    }
  },
  {
    "image": "https://images.kaplanco.com/catalog/jumbo/27583.jpg",
    "query": "Learning Resources Write Wipe Pockets",
    "en": {
      "title": "Reusable dry-erase pockets",
      "blurb": "Slip in your own character grids, sentence frames, or information-gap sheets. Partners can swap sheets and repeat with new vocabulary."
    },
    "zh": {
      "title": "可重复使用的透明可擦写袋",
      "blurb": "放入自制田字格、句型框架或信息差学习单，擦掉重练；同伴交换材料，就能用新词再做一轮。"
    }
  },
  {
    "image": "https://m.media-amazon.com/images/I/61OiIedpx%2BL.jpg",
    "query": "blank index cards assorted colors",
    "en": {
      "title": "Blank vocabulary & sentence cards",
      "blurb": "Write your own target-language words. Sort by meaning, match pictures to words, or rearrange cards into sentences. Use colors for sentence roles."
    },
    "zh": {
      "title": "空白词卡与句子卡",
      "blurb": "按教学内容自制词卡，用来分类、图文配对、排句子；用不同颜色区分人物、动作和地点。"
    }
  },
  {
    "image": "https://m.media-amazon.com/images/I/61Bn2w7J2dL.jpg",
    "query": "Godery tabletop desktop pocket chart",
    "en": {
      "title": "Tabletop pocket chart",
      "blurb": "Make word order visible with your own cards. Students move words to build statements, questions, and expanded sentences in the language you teach."
    },
    "zh": {
      "title": "桌面句子插袋架",
      "blurb": "插入自制词卡，让学生移动词语，练习陈述句、问句和扩句；中文、英语及其他语言都可按自己的句型使用。"
    }
  },
  {
    "image": "https://media.teaching.com.au/uploads/tfc10593/tfc10593_pocket-cube-dice-6p_v1_1.webp",
    "query": "foam dice clear pockets insert cards",
    "en": {
      "title": "Insert-your-own-card dice",
      "blurb": "Insert pictures or prompts in your target language. Roll for a character, action, or place, then ask partners to make a sentence or continue a story."
    },
    "zh": {
      "title": "可换卡片的口语骰子",
      "blurb": "换入图片或目标语言提示卡，掷出人物、动作或地点，让同伴造句或接着讲故事。选可换卡款，方便适配不同语言。"
    }
  },
  {
    "image": "https://m.media-amazon.com/images/I/71CkUduKTAL.jpg",
    "query": "Learning Resources recordable answer buzzers",
    "en": {
      "title": "Recordable audio buttons",
      "blurb": "Record a short model phrase for a listening station. Learners listen, respond, and record their own version. Choose recordable buttons, rather than sound-only buzzers."
    },
    "zh": {
      "title": "可录音按钮",
      "blurb": "录下示范短句，用作听说学习站；学生先听、再回应，也可录下自己的版本。选购时确认支持录音，并核对录音时长。"
    }
  },
  {
    "image": "https://m.media-amazon.com/images/I/81Wyb24nppL._AC_SL1500_.jpg",
    "query": "animal hand puppets classroom storytelling",
    "en": {
      "title": "Hand puppets for dialogue",
      "blurb": "Give partners two characters for greetings, shopping, or asking for help. Add a simple dialogue frame, then let students change the details."
    },
    "zh": {
      "title": "对话与故事手偶",
      "blurb": "用两个角色练习问候、购物或求助对话；先提供句型支架，再让学生替换细节，也适合故事复述。"
    }
  },
  {
    "image": "https://m.media-amazon.com/images/I/71yuwlDN9dL._AC_SL1500_.jpg",
    "query": "Post-it Super Sticky Notes",
    "en": {
      "title": "Sticky notes for reading & exit tickets",
      "blurb": "Mark a question, predict the next event, or write one new phrase before leaving. Move notes into groups to compare ideas; use scrap paper when sticking is unnecessary."
    },
    "zh": {
      "title": "阅读批注与离堂反馈便利贴",
      "blurb": "阅读时写问题、做预测，离堂前写一个新句子；把便签移动分类、比较观点。不需要粘贴的活动也可用废纸代替。"
    }
  }
].map(function (pick, index) {
  return {
    rank: index + 1,
    imageUrl: pick.image,
    productUrl: 'https://www.amazon.com/s?k=' + encodeURIComponent(pick.query) + '&tag=' + AFFILIATE_TAG,
    en: pick.en,
    zh: pick.zh
  };
});
