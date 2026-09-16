IF NOT EXISTS (SELECT 1 FROM recommendation_products WHERE slug = N'15-drawer-rolling-cart')
BEGIN
  INSERT INTO recommendation_products (
    slug, title, subtitle, category, description, image_url, image_alt,
    product_url, link_text, link_note, reasons, teacher_tip_title, teacher_tip,
    printable_label_url, printable_label_text, printable_label_note, sort_order, is_published
  )
  VALUES (
    N'15-drawer-rolling-cart',
    N'15 格抽屉教室收纳推车',
    N'为材料、学习站和学生作品提供的移动小家',
    N'好物 01 · 教室整理',
    N'当教室里材料很多却在上课时不容易找到时，这类收纳推车会很实用。不同大小和颜色的抽屉便于按班级、单元、项目或活动类型整理，脚轮又能让推车在备课区、教学区和学生学习站之间轻松移动。',
    N'/images/15-drawer-rolling-cart.png',
    N'Classroom rolling cart with fifteen colorful drawers, a top work surface, and wheels',
    N'https://amzn.to/4qpPByl',
    N'在 Amazon 上查看这款收纳推车 →',
    N'佣金链接 · 购买前请在 Amazon 上确认当前尺寸、价格、库存和产品细节。',
    N'[{"title":"大抽屉可以整套收纳","text":"存放工作单、学生作品、可打印游戏、实验单、美术材料，或等待批改的作业。为每个班级设定不同颜色，取用会更快。"},{"title":"小抽屉可以分类零散用品","text":"把卡片、骰子、磁贴、马克笔、便利贴、教具和出门条统一放在固定位置，学生也能协助整理维护。"},{"title":"它也能变成一个学习站","text":"用顶部放置任务篮或演示材料，再把推车推到小组旁，减少分发用品所花的时间。"}]',
    N'课堂使用小贴士：',
    N'把较重的纸张和用品放在下层抽屉，较轻的物品放在上层。贴上图文标签，方便学生独立归还材料。使用前锁好脚轮，并提醒学生不要爬上推车，也不要同时拉出多个装满的抽屉。',
    NULL,
    N'下载配套抽屉标签',
    N'可放班级、单元、游戏卡、作业待批、已批改等标签；PDF 准备好后把链接填到这里。',
    1,
    1
  );
END
