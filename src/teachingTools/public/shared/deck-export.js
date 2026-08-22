/*!
 * deck-export.js  ·  陈老师教学工具
 * 把一叠图片（JPEG 字节）打包成 PPTX 或 PDF —— 纯前端，不依赖任何外部库。
 *
 *   DeckExport.buildPPTX(images, opts) -> Uint8Array
 *   DeckExport.buildPDF(images, opts)  -> Uint8Array
 *   DeckExport.svgToJpeg(svgText, w, h, scale) -> Promise<Uint8Array>   （浏览器里用）
 *   DeckExport.download(filename, bytes, mime)
 *
 * images: [{ bytes: Uint8Array, w: number, h: number }]
 */
(function (global) {
  'use strict';

  // ---------------- utils ----------------
  function strBytes(s) {
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  }
  function utf8Bytes(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var utf = unescape(encodeURIComponent(s));
    return strBytes(utf);
  }
  function concat(chunks) {
    var len = 0, i;
    for (i = 0; i < chunks.length; i++) len += chunks[i].length;
    var out = new Uint8Array(len), off = 0;
    for (i = 0; i < chunks.length; i++) { out.set(chunks[i], off); off += chunks[i].length; }
    return out;
  }

  // ---------------- CRC32 ----------------
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ---------------- ZIP (store, no compression) ----------------
  function zip(files) {
    var locals = [], centrals = [], offset = 0;
    files.forEach(function (f) {
      var nameB = utf8Bytes(f.name);
      var data = f.data;
      var crc = crc32(data);
      var lh = new Uint8Array(30 + nameB.length);
      var dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);          // version needed
      dv.setUint16(6, 0x0800, true);      // UTF-8 flag
      dv.setUint16(8, 0, true);           // stored
      dv.setUint16(10, 0, true);          // time
      dv.setUint16(12, 0, true);          // date
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, nameB.length, true);
      dv.setUint16(28, 0, true);
      lh.set(nameB, 30);
      locals.push(lh, data);

      var ch = new Uint8Array(46 + nameB.length);
      var cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameB.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      ch.set(nameB, 46);
      centrals.push(ch);

      offset += lh.length + data.length;
    });
    var centralBytes = concat(centrals);
    var end = new Uint8Array(22);
    var ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralBytes.length, true);
    ev.setUint32(16, offset, true);
    return concat([concat(locals), centralBytes, end]);
  }

  // ---------------- PPTX ----------------
  var DEFAULT_EMU_W = 12192000, DEFAULT_EMU_H = 6858000;   // 13.333 x 7.5 in  (16:9)

  function pptxTheme() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office">' +
      '<a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
      '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1B2A47"/></a:dk2>' +
      '<a:lt2><a:srgbClr val="FBF6E9"/></a:lt2><a:accent1><a:srgbClr val="35604C"/></a:accent1>' +
      '<a:accent2><a:srgbClr val="F6C43C"/></a:accent2><a:accent3><a:srgbClr val="A9C99A"/></a:accent3>' +
      '<a:accent4><a:srgbClr val="C0392B"/></a:accent4><a:accent5><a:srgbClr val="5A9E4B"/></a:accent5>' +
      '<a:accent6><a:srgbClr val="E3A81C"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink>' +
      '<a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>' +
      '<a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
      '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
      '<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
      '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
      '<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
      '<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
      '<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
      '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>' +
      '<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
      '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
      '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>' +
      '</a:fmtScheme></a:themeElements></a:theme>';
  }

  function pptxMaster() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
      '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>' +
      '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" ' +
      'accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
      '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>';
  }

  function pptxLayout() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">' +
      '<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
      '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>' +
      '<p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" ' +
      'accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" ' +
      'hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sldLayout>';
  }

  function pptxSlide(i, emuW, emuH) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
      '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
      '<p:pic><p:nvPicPr><p:cNvPr id="2" name="Card ' + (i + 1) + '"/>' +
      '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
      '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
      '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + emuW + '" cy="' + emuH + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>' +
      '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
  }

  function buildPPTX(images, opts) {
    opts = opts || {};
    var n = images.length;
    var files = [];
    var i;
    // PowerPoint uses 12,700 EMUs per point. Existing callers keep the
    // original 16:9 default; printable tools can opt into portrait pages.
    var emuW = opts.emuWidth || (opts.pageWidth ? Math.round(opts.pageWidth * 12700) : DEFAULT_EMU_W);
    var emuH = opts.emuHeight || (opts.pageHeight ? Math.round(opts.pageHeight * 12700) : DEFAULT_EMU_H);

    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>';
    for (i = 0; i < n; i++) {
      ct += '<Override PartName="/ppt/slides/slide' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>';
    }
    ct += '</Types>';
    files.push({ name: '[Content_Types].xml', data: utf8Bytes(ct) });

    files.push({
      name: '_rels/.rels', data: utf8Bytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>' +
        '</Relationships>')
    });

    var sldIds = '', presRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>';
    for (i = 0; i < n; i++) {
      var rid = 'rId' + (i + 2);
      sldIds += '<p:sldId id="' + (256 + i) + '" r:id="' + rid + '"/>';
      presRels += '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + (i + 1) + '.xml"/>';
    }
    presRels += '<Relationship Id="rId' + (n + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>';

    files.push({
      name: 'ppt/presentation.xml', data: utf8Bytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">' +
        '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
        '<p:sldIdLst>' + sldIds + '</p:sldIdLst>' +
        '<p:sldSz cx="' + emuW + '" cy="' + emuH + '"/><p:notesSz cx="' + emuH + '" cy="' + emuW + '"/>' +
        '</p:presentation>')
    });
    files.push({ name: 'ppt/_rels/presentation.xml.rels', data: utf8Bytes(presRels) });
    files.push({ name: 'ppt/theme/theme1.xml', data: utf8Bytes(pptxTheme()) });
    files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: utf8Bytes(pptxMaster()) });
    files.push({
      name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: utf8Bytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>' +
        '</Relationships>')
    });
    files.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: utf8Bytes(pptxLayout()) });
    files.push({
      name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: utf8Bytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>' +
        '</Relationships>')
    });

    for (i = 0; i < n; i++) {
      files.push({ name: 'ppt/slides/slide' + (i + 1) + '.xml', data: utf8Bytes(pptxSlide(i, emuW, emuH)) });
      files.push({
        name: 'ppt/slides/_rels/slide' + (i + 1) + '.xml.rels', data: utf8Bytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image' + (i + 1) + '.jpeg"/>' +
          '</Relationships>')
      });
      files.push({ name: 'ppt/media/image' + (i + 1) + '.jpeg', data: images[i].bytes });
    }
    return zip(files);
  }

  // ---------------- PDF ----------------
  function buildPDF(images, opts) {
    opts = opts || {};
    // page size in points; default = 16:9 landscape roughly A4-wide
    var PW = opts.pageWidth || 792, PH = opts.pageHeight || 445.5;
    var objects = [];         // array of Uint8Array bodies (without "n 0 obj")
    function addObj(bytes) { objects.push(bytes); return objects.length; }

    var n = images.length;
    var kids = [];
    var pageObjNums = [];

    // reserve 1 = catalog, 2 = pages
    addObj(utf8Bytes('<< /Type /Catalog /Pages 2 0 R >>'));
    addObj(utf8Bytes('PLACEHOLDER_PAGES'));

    for (var i = 0; i < n; i++) {
      var img = images[i];
      // fit image into page keeping aspect
      var scale = Math.min(PW / img.w, PH / img.h);
      var dw = img.w * scale, dh = img.h * scale;
      var dx = (PW - dw) / 2, dy = (PH - dh) / 2;

      var contentStr = 'q ' + dw.toFixed(2) + ' 0 0 ' + dh.toFixed(2) + ' ' + dx.toFixed(2) + ' ' + dy.toFixed(2) + ' cm /Im0 Do Q';
      var contentNum = addObj(concat([
        utf8Bytes('<< /Length ' + contentStr.length + ' >>\nstream\n'),
        utf8Bytes(contentStr),
        utf8Bytes('\nendstream')
      ]));
      var imgNum = addObj(concat([
        utf8Bytes('<< /Type /XObject /Subtype /Image /Width ' + img.w + ' /Height ' + img.h +
          ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.bytes.length + ' >>\nstream\n'),
        img.bytes,
        utf8Bytes('\nendstream')
      ]));
      var pageNum = addObj(utf8Bytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] ' +
        '/Resources << /XObject << /Im0 ' + imgNum + ' 0 R >> >> /Contents ' + contentNum + ' 0 R >>'));
      pageObjNums.push(pageNum);
      kids.push(pageNum + ' 0 R');
    }

    objects[1] = utf8Bytes('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>');

    // assemble
    var chunks = [utf8Bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
    var pos = chunks[0].length;
    var offsets = [0];
    for (var k = 0; k < objects.length; k++) {
      offsets.push(pos);
      var head = utf8Bytes((k + 1) + ' 0 obj\n');
      var tail = utf8Bytes('\nendobj\n');
      chunks.push(head, objects[k], tail);
      pos += head.length + objects[k].length + tail.length;
    }
    var xrefPos = pos;
    var xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
    for (var m = 1; m <= objects.length; m++) {
      xref += String(offsets[m]).padStart(10, '0') + ' 00000 n \n';
    }
    xref += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n';
    chunks.push(utf8Bytes(xref));
    return concat(chunks);
  }

  // ---------------- browser helpers ----------------
  function svgToJpeg(svgText, w, h, scale, quality) {
    scale = scale || 1.5;
    quality = quality || 0.92;
    return new Promise(function (resolve, reject) {
      var blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = Math.round(w * scale);
        cv.height = Math.round(h * scale);
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#FBF6E9';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) {
          if (!b) { reject(new Error('toBlob failed')); return; }
          var fr = new FileReader();
          fr.onload = function () {
            resolve({ bytes: new Uint8Array(fr.result), w: cv.width, h: cv.height });
          };
          fr.readAsArrayBuffer(b);
        }, 'image/jpeg', quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('svg load failed')); };
      img.src = url;
    });
  }

  function download(filename, bytes, mime) {
    var blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  global.DeckExport = {
    version: '1.0',
    zip: zip,
    crc32: crc32,
    buildPPTX: buildPPTX,
    buildPDF: buildPDF,
    svgToJpeg: svgToJpeg,
    download: download
  };
})(typeof window !== 'undefined' ? window : this);
