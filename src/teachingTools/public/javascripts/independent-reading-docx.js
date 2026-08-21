(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("docx"));
    return;
  }

  root.IndependentReadingDocx = factory(root.docx);
})(typeof window !== "undefined" ? window : globalThis, function (docx) {
  "use strict";

  if (!docx) {
    throw new Error("The Word document library could not be loaded.");
  }

  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeightRule,
    LevelFormat,
    LevelSuffix,
    PageBreak,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = docx;

  const COLORS = {
    blue: "1F5F99",
    darkBlue: "173D63",
    ink: "1E2936",
    softBlue: "EAF3F9",
    line: "9BB5C9",
    lightLine: "B6C2CC",
  };

  const CONTENT_WIDTH = 9360;

  function cleanText(value) {
    return String(value || "").trim();
  }

  function border(color, size) {
    return {
      color: color || COLORS.blue,
      size: size || 8,
      style: BorderStyle.SINGLE,
    };
  }

  function allBorders(color, size) {
    const side = border(color, size);
    return {
      top: side,
      bottom: side,
      left: side,
      right: side,
      insideHorizontal: side,
      insideVertical: side,
    };
  }

  function pageBreak() {
    return new Paragraph({ children: [new PageBreak()] });
  }

  function answerLine() {
    return new Paragraph({
      border: { bottom: border(COLORS.lightLine, 4) },
      children: [new TextRun({ text: " ", size: 22 })],
      spacing: { after: 170, line: 300 },
    });
  }

  function sectionHeading(text) {
    return new Paragraph({
      style: "SectionHeading",
      children: [new TextRun({ text })],
    });
  }

  function instructionalText(chinese, english) {
    return new Paragraph({
      style: "Instruction",
      children: [
        new TextRun({ text: chinese }),
        new TextRun({ text: "  " }),
        new TextRun({ text: `(${english})`, italics: true }),
      ],
    });
  }

  function paragraph(text, options) {
    return new Paragraph({
      text,
      ...(options || {}),
    });
  }

  function numberedParagraph(reference, text) {
    return new Paragraph({
      text,
      numbering: { reference, level: 0 },
    });
  }

  function bulletParagraph(text) {
    return new Paragraph({
      text,
      numbering: { reference: "teacher-use-cases", level: 0 },
    });
  }

  function storyTable(story) {
    const storyLines = cleanText(story)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const storyChildren = storyLines.map(
      (line) =>
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              font: "Microsoft YaHei",
              size: 26,
              color: COLORS.ink,
            }),
          ],
          spacing: { after: 110, line: 360 },
        })
    );

    return new Table({
      alignment: AlignmentType.LEFT,
      borders: allBorders(COLORS.blue, 8),
      columnWidths: [CONTENT_WIDTH],
      indent: { size: 120, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: storyChildren,
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: COLORS.softBlue },
              verticalAlign: VerticalAlign.TOP,
              width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            }),
          ],
        }),
      ],
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    });
  }

  function storyboardCell(scene) {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text: String(scene), bold: true, color: COLORS.blue, size: 24 })],
          spacing: { after: 0 },
        }),
        new Paragraph({ children: [new TextRun({ text: " " })], spacing: { after: 0 } }),
      ],
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      verticalAlign: VerticalAlign.TOP,
      width: { size: 4680, type: WidthType.DXA },
    });
  }

  function storyboardTable() {
    return new Table({
      alignment: AlignmentType.LEFT,
      borders: allBorders(COLORS.ink, 6),
      columnWidths: [4680, 4680],
      indent: { size: 120, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      rows: [0, 1, 2].map(
        (row) =>
          new TableRow({
            children: [storyboardCell(row * 2 + 1), storyboardCell(row * 2 + 2)],
            height: { value: 2100, rule: HeightRule.ATLEAST },
          })
      ),
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    });
  }

  function getStyles() {
    return {
      default: {
        document: {
          run: { font: "Aptos", size: 22, color: COLORS.ink },
          paragraph: { spacing: { after: 120, line: 300 } },
        },
      },
      paragraphStyles: [
        {
          id: "PacketTitle",
          name: "Packet Title",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Cambria", size: 48, bold: true, color: COLORS.blue },
          paragraph: { spacing: { after: 70, line: 300 } },
        },
        {
          id: "PacketSubtitle",
          name: "Packet Subtitle",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Cambria", size: 23, italics: true, color: "51667C" },
          paragraph: { spacing: { after: 220, line: 300 } },
        },
        {
          id: "SectionHeading",
          name: "Worksheet Section Heading",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Cambria", size: 31, bold: true, color: COLORS.blue },
          paragraph: {
            border: { bottom: border(COLORS.blue, 10) },
            spacing: { before: 130, after: 90, line: 300 },
          },
        },
        {
          id: "StoryLabel",
          name: "Storyboard Label",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Cambria", size: 22, bold: true, color: "51667C" },
          paragraph: { spacing: { after: 70, line: 300 } },
        },
        {
          id: "StoryTitle",
          name: "Story Title",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Microsoft YaHei", size: 40, bold: true, color: COLORS.blue },
          paragraph: { spacing: { after: 30, line: 300 } },
        },
        {
          id: "StorySubtitle",
          name: "Story Subtitle",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Cambria", size: 23, italics: true, color: "51667C" },
          paragraph: { spacing: { after: 150, line: 300 } },
        },
        {
          id: "Instruction",
          name: "Worksheet Instruction",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Aptos", size: 21, color: "3D5064" },
          paragraph: { spacing: { after: 100, line: 300 } },
        },
      ],
    };
  }

  function getNumbering() {
    const numberLevel = (reference) => ({
      reference,
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          suffix: LevelSuffix.SPACE,
          style: {
            paragraph: { indent: { left: 540, hanging: 270 }, spacing: { after: 100, line: 300 } },
            run: { font: "Aptos", size: 24, color: COLORS.ink },
          },
        },
      ],
    });

    return {
      config: [
        numberLevel("questions"),
        numberLevel("teacher-workflow"),
        numberLevel("substitute-steps"),
        {
          reference: "teacher-use-cases",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              suffix: LevelSuffix.SPACE,
              style: {
                paragraph: { indent: { left: 540, hanging: 270 }, spacing: { after: 70, line: 300 } },
                run: { font: "Aptos", size: 23, color: COLORS.ink },
              },
            },
          ],
        },
      ],
    };
  }

  function createDocument(input) {
    const title = cleanText(input.title) || "Untitled Story";
    const englishTitle = cleanText(input.englishTitle);
    const story = cleanText(input.story);
    const questions = (input.questions || []).map(cleanText).filter(Boolean);
    const storyReference = englishTitle ? `${title} · ${englishTitle}` : title;
    const children = [
      paragraph("Teacher Notes", { style: "PacketTitle" }),
      paragraph("Independent Reading Storyboard Packet · Novice Level", { style: "PacketSubtitle" }),
      paragraph(
        "This no-prep packet is designed for independent Chinese reading, comprehension, creative writing, and drawing. Students can complete the pages in order with only a writing utensil."
      ),
      paragraph("Works especially well for:", { run: { bold: true }, spacing: { before: 80, after: 80 } }),
      bulletParagraph("Emergency substitute plans"),
      bulletParagraph("Planned absences and independent work days"),
      bulletParagraph("Testing days and early finishers"),
      sectionHeading("Student workflow"),
      numberedParagraph("teacher-workflow", "Read the story carefully."),
      numberedParagraph("teacher-workflow", "Answer the comprehension questions."),
      numberedParagraph("teacher-workflow", "Write a new version of the text or story."),
      numberedParagraph("teacher-workflow", "Illustrate the six-scene storyboard."),
      paragraph(
        "Optional support: preview the story, add a small word bank, or invite advanced learners to expand the rewrite with dialogue and detail.",
        { spacing: { before: 160 } }
      ),
      pageBreak(),
      paragraph("Instructions for the Substitute", { style: "PacketTitle" }),
      paragraph("Clear student directions · Independent practice · Low prep", { style: "PacketSubtitle" }),
      paragraph(
        "Welcome! Each student receives one storyboard packet and works through it independently from start to finish. The pages include the story, questions, a rewrite page, and a drawing page."
      ),
      sectionHeading("What students do (in order)"),
      numberedParagraph("substitute-steps", "Read the story. Students read the short Chinese story silently or quietly to themselves."),
      numberedParagraph("substitute-steps", "Answer the questions. Students write short responses on the provided lines."),
      numberedParagraph("substitute-steps", "Rewrite the text. Students create a new version and may change the ending or conclusion."),
      numberedParagraph("substitute-steps", "Illustrate. Students represent the reading across six numbered boxes, like a storyboard or comic."),
      sectionHeading("Housekeeping"),
      bulletParagraph("Students may work at their own pace. One complete packet is a strong day’s work."),
      bulletParagraph("Fast finishers may start a second packet or add detail to their rewrite."),
      bulletParagraph("Please collect the packets at the end of class and leave them on the teacher’s desk."),
      pageBreak(),
      paragraph("Reading 1 · Storyboard 1", { style: "StoryLabel" }),
      paragraph(title, { style: "StoryTitle" }),
      paragraph(englishTitle || "Independent Reading", { style: "StorySubtitle" }),
      instructionalText("Instructions: Read the text below carefully.", ""),
      storyTable(story),
      sectionHeading("Check Your Understanding"),
      instructionalText("Answer the questions using evidence from the reading.", ""),
    ];

    questions.forEach((question) => {
      children.push(numberedParagraph("questions", question));
      children.push(answerLine());
    });

    children.push(
      pageBreak(),
      paragraph(storyReference, { style: "StoryLabel" }),
      sectionHeading("Write a New Version"),
      instructionalText("Rewrite the text in your own words. You may change the ending or conclusion.", ""),
      ...Array.from({ length: 11 }, answerLine),
      pageBreak(),
      paragraph(storyReference, { style: "StoryLabel" }),
      sectionHeading("Six-Scene Storyboard"),
      instructionalText("Represent the reading across the six boxes, like a storyboard or comic strip.", ""),
      storyboardTable()
    );

    return new Document({
      creator: "Teacher Toolkit",
      description: "Independent Reading Storyboard Packet",
      numbering: getNumbering(),
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 709, footer: 709 },
              size: { width: 12240, height: 15840 },
            },
          },
          children,
        },
      ],
      styles: getStyles(),
      subject: "Independent Reading Storyboard",
      title: `${title} - Independent Reading Storyboard`,
    });
  }

  function fileName(title) {
    const safeTitle = cleanText(title)
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 70);
    return `${safeTitle || "independent-reading"}-storyboard-packet.docx`;
  }

  return { createDocument, fileName };
});
