'use strict';

// Development seed only; production keeps this record in activity_materials (0012).
module.exports = {
  id: 'five-elements-planets', ownerKey: null, theme: 'five-elements', title: '五行星球活动',
  description: '星球寻宝彩铅版，六张 A4 大图。', descriptionEn: 'Planet treasure hunt: six A4 colored-pencil pictures.',
  limitedFree: true, preview: '', revision: 1,
  files: [
    { name: '星球寻宝_彩铅版_六张A4大图.pdf', url: 'https://chenlaoshitteaching.blob.core.windows.net/printables/five-elements/planet-treasure-hunt-pencil-a4.pdf' },
    { name: '星球寻宝_彩铅版_六张A4大图.docx', url: 'https://chenlaoshitteaching.blob.core.windows.net/printables/five-elements/planet-treasure-hunt-pencil-a4.docx' }
  ],
  lessons: [{ id: 1, series: 'jinan', book: 'book-1', slug: 'jinan-1-04', lessonNo: 4, title: '金木水火土' }]
};
