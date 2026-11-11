-- The self-introduction and Halloween printables that were hard-coded in routes/siteStructure.js
-- become activity materials, so they can be managed at /admin/materials. Their files stay where
-- they are (the site's /printables folder and the public printables blob container).
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS (SELECT 1 FROM dbo.activity_materials WHERE id = 'self-intro-who-am-i')
    INSERT INTO dbo.activity_materials (id, theme, themes, title, description, description_en, limited_free, files)
    VALUES ('self-intro-who-am-i', 'self-introduction', N'["self-introduction"]', N'Who Am I? 我是谁？阅读卡片',
        N'阅读 6 段人物介绍，将每段与对应的人物字母配对。练习姓名、年龄、生日、爱好、物品和居住地等表达。共 2 页。',
        N'Read six personal introductions and match each one to a character letter. Practice names, ages, birthdays, hobbies, possessions, and places of residence. 2 pages.', 1,
        N'[{"name":"Who Am I 我是谁 阅读卡片.pdf","url":"/printables/self-introduction/who-am-i-reading-cards.pdf"},{"name":"Who Am I 我是谁 阅读卡片.docx","url":"/printables/self-introduction/who-am-i-reading-cards.docx"}]');
IF NOT EXISTS (SELECT 1 FROM dbo.activity_materials WHERE id = 'self-intro-guess-who')
    INSERT INTO dbo.activity_materials (id, theme, themes, title, description, description_en, limited_free, files)
    VALUES ('self-intro-guess-who', 'self-introduction', N'["self-introduction"]', N'Guess Who? 猜人游戏卡片',
        N'用中文提问和回答，猜出同伴选的是哪个人物。共 4 页。',
        N'Ask and answer questions in Chinese to guess your partner’s character. 4 pages.', 1,
        N'[{"name":"Guess Who 猜人游戏卡片.pdf","url":"/printables/self-introduction/guess-who-game-cards.pdf"},{"name":"Guess Who 猜人游戏卡片.pptx","url":"/printables/self-introduction/guess-who-game-cards.pptx"}]');
IF NOT EXISTS (SELECT 1 FROM dbo.activity_materials WHERE id = 'halloween-secret-message')
    INSERT INTO dbo.activity_materials (id, theme, themes, title, description, description_en, limited_free, files)
    VALUES ('halloween-secret-message', 'halloween', N'["halloween"]', N'万圣节图形密码 · Secret Message',
        N'对照图形密码表，写出汉字，解开老师的万圣节秘密信息。含练习纸和答案页，共 2 页。',
        N'Decode Halloween pictures to reveal a secret message from your teacher. Includes a worksheet and answer key. 2 pages.', 0,
        N'[{"name":"万圣节图形密码 Secret Message.pdf","url":"/printables/halloween/halloween-secret-message.pdf"}]');
IF NOT EXISTS (SELECT 1 FROM dbo.activity_materials WHERE id = 'halloween-gallery-walk')
    INSERT INTO dbo.activity_materials (id, theme, themes, title, description, description_en, limited_free, files)
    VALUES ('halloween-gallery-walk', 'halloween', N'["halloween"]', N'万圣节方位词_Gallery_Walk',
        N'读方位词句子，在教室里找到对应的图片并写下字母。含 10 张图片卡和答案，共 12 页。',
        N'Read each position-word sentence, find the matching picture around the room, and write its letter. Includes 10 picture cards and an answer key. 12 pages.', 1,
        N'[{"name":"万圣节方位词_Gallery_Walk.pdf","url":"https://chenlaoshitteaching.blob.core.windows.net/printables/halloween/halloween-position-words-gallery-walk.pdf"},{"name":"万圣节方位词_Gallery_Walk.docx","url":"https://chenlaoshitteaching.blob.core.windows.net/printables/halloween/halloween-position-words-gallery-walk.docx"}]');
IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0017_move-printables-to-materials')
    INSERT INTO dbo.schema_migrations (id) VALUES (N'0017_move-printables-to-materials');
COMMIT;
