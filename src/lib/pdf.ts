import { access, readFile } from "node:fs/promises";
import path from "node:path";

type PdfMetric = {
  label: string;
  value: string;
};

type PdfSectionItem = {
  label: string;
  value?: string;
  subtitle?: string;
  fields?: Array<{
    label: string;
    value: string;
    emphasis?: "default" | "highlight";
  }>;
};

type StyledPdfSection = {
  title: string;
  description?: string;
  items: PdfSectionItem[];
  columns?: 1 | 2;
};

type StyledPdfDocument = {
  title: string;
  subtitle: string;
  badge: string;
  generatedAt: string;
  heroMetrics: PdfMetric[];
  sections: StyledPdfSection[];
  footerNote?: string;
};

type PdfFontOptions = {
  regularPath?: string;
  boldPath?: string;
  regularBuffer?: Buffer;
  boldBuffer?: Buffer;
};

type PdfRenderOptions = {
  fonts?: PdfFontOptions;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 42;
const PAGE_MARGIN_TOP = 36;
const PAGE_MARGIN_BOTTOM = 44;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN_X * 2;
const COL_UNIT = CONTENT_WIDTH / 12;
const BASE_GAP = 12;
const SECTION_GAP = 32;
const FOOTER_HEIGHT = 28;

const COLOR_TEXT_PRIMARY: [number, number, number] = [15 / 255, 23 / 255, 42 / 255];
const COLOR_TEXT_MUTED: [number, number, number] = [100 / 255, 116 / 255, 139 / 255];
const COLOR_ACCENT: [number, number, number] = [37 / 255, 99 / 255, 235 / 255];
const COLOR_SURFACE: [number, number, number] = [248 / 255, 250 / 255, 252 / 255];
const COLOR_HAIRLINE: [number, number, number] = [226 / 255, 232 / 255, 240 / 255];
const COLOR_WHITE: [number, number, number] = [1, 1, 1];

const TYPE = {
  heading: { size: 19, lineGap: 5 },
  sectionTitle: { size: 12, lineGap: 4 },
  dataValue: { size: 16, lineGap: 4 },
  label: { size: 7.5, lineGap: 3 },
  body: { size: 9, lineGap: 4 },
} as const;

const TITLE_CASE_LABELS = new Set([
  "ROLE NAME",
  "KATEGORI",
  "PROJECT CATEGORY",
  "COMPANY CATEGORY",
  "ROLE SUPPORTING",
  "NAMA POSISI",
  "KATEGORI PROYEK",
  "KATEGORI PERUSAHAAN",
  "PERAN SUPPORTING",
  "JABATAN / KUALIFIKASI",
]);

function toTitleCase(text: string) {
  return text
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sanitizePdfText(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function normalizeVariableValue(label: string, value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue === "-") {
    return trimmedValue || "-";
  }

  return TITLE_CASE_LABELS.has(label.toUpperCase()) ? toTitleCase(trimmedValue) : trimmedValue;
}

function rgb(color: [number, number, number]) {
  return `${color[0]} ${color[1]} ${color[2]}`;
}

function estimateTextWidth(text: string, fontSize: number) {
  let width = 0;

  for (const char of text) {
    if (char === " ") {
      width += fontSize * 0.28;
      continue;
    }

    if ("ilIjtfr".includes(char)) {
      width += fontSize * 0.24;
      continue;
    }

    if ("mwMW@#%&".includes(char)) {
      width += fontSize * 0.78;
      continue;
    }

    if ("0123456789".includes(char)) {
      width += fontSize * 0.56;
      continue;
    }

    if (",.:;|!/\\()[]{}".includes(char)) {
      width += fontSize * 0.22;
      continue;
    }

    width += fontSize * 0.52;
  }

  return width;
}

function wrapText(text: string, width: number, fontSize: number) {
  const normalized = text.replace(/\r/g, "").trim();

  if (!normalized) {
    return [""];
  }

  const lines: string[] = [];

  for (const paragraph of normalized.split("\n")) {
    const words = paragraph.trim().replace(/\s+/g, " ").split(" ");
    let current = "";

    for (const word of words) {
      if (!word) {
        continue;
      }

      const candidate = current ? `${current} ${word}` : word;

      if (estimateTextWidth(candidate, fontSize) <= width) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
        current = "";
      }

      if (estimateTextWidth(word, fontSize) <= width) {
        current = word;
        continue;
      }

      let segment = "";

      for (const char of word) {
        const nextSegment = `${segment}${char}`;

        if (estimateTextWidth(nextSegment, fontSize) <= width) {
          segment = nextSegment;
          continue;
        }

        if (segment) {
          lines.push(segment);
        }

        segment = char;
      }

      current = segment;
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines.length > 0 ? lines : [""];
}

function estimateWrappedTextHeight(text: string, width: number, fontSize: number, lineGap: number) {
  const lines = wrapText(text, width, fontSize);
  return lines.length * fontSize + Math.max(0, lines.length - 1) * lineGap;
}

function pdfRectPath(x: number, yTop: number, width: number, height: number) {
  const yBottom = PAGE_HEIGHT - yTop - height;
  return `${x} ${yBottom} ${width} ${height} re`;
}

function pdfRoundedRectPath(
  x: number,
  yTop: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const k = 0.5522847498;
  const c = r * k;
  const left = x;
  const right = x + width;
  const top = PAGE_HEIGHT - yTop;
  const bottom = PAGE_HEIGHT - yTop - height;

  return [
    `${left + r} ${top} m`,
    `${right - r} ${top} l`,
    `${right - r + c} ${top} ${right} ${top - r + c} ${right} ${top - r} c`,
    `${right} ${bottom + r} l`,
    `${right} ${bottom + r - c} ${right - r + c} ${bottom} ${right - r} ${bottom} c`,
    `${left + r} ${bottom} l`,
    `${left + r - c} ${bottom} ${left} ${bottom + r - c} ${left} ${bottom + r} c`,
    `${left} ${top - r} l`,
    `${left} ${top - r + c} ${left + r - c} ${top} ${left + r} ${top} c`,
    "h",
  ].join("\n");
}

function drawFilledRect(
  commands: string[],
  x: number,
  yTop: number,
  width: number,
  height: number,
  color: [number, number, number]
) {
  commands.push("q");
  commands.push(`${rgb(color)} rg`);
  commands.push(pdfRectPath(x, yTop, width, height));
  commands.push("f");
  commands.push("Q");
}

function drawFilledRoundedRect(
  commands: string[],
  x: number,
  yTop: number,
  width: number,
  height: number,
  radius: number,
  color: [number, number, number]
) {
  commands.push("q");
  commands.push(`${rgb(color)} rg`);
  commands.push(pdfRoundedRectPath(x, yTop, width, height, radius));
  commands.push("f");
  commands.push("Q");
}

function drawLine(
  commands: string[],
  x1: number,
  y1Top: number,
  x2: number,
  y2Top: number,
  color: [number, number, number],
  lineWidth = 0.5
) {
  commands.push("q");
  commands.push(`${lineWidth} w`);
  commands.push(`${rgb(color)} RG`);
  commands.push(`${x1} ${PAGE_HEIGHT - y1Top} m`);
  commands.push(`${x2} ${PAGE_HEIGHT - y2Top} l`);
  commands.push("S");
  commands.push("Q");
}

function drawText(
  commands: string[],
  text: string,
  x: number,
  yTop: number,
  options?: {
    font?: "regular" | "bold";
    fontSize?: number;
    color?: [number, number, number];
  }
) {
  const font = options?.font === "bold" ? "F2" : "F1";
  const fontSize = options?.fontSize ?? TYPE.body.size;
  const color = options?.color ?? COLOR_TEXT_PRIMARY;
  const baselineY = PAGE_HEIGHT - yTop - fontSize;

  commands.push("BT");
  commands.push(`/${font} ${fontSize} Tf`);
  commands.push(`${rgb(color)} rg`);
  commands.push(`${x} ${baselineY} Td`);
  commands.push(`(${sanitizePdfText(text)}) Tj`);
  commands.push("ET");
}

function drawRightAlignedText(
  commands: string[],
  text: string,
  rightX: number,
  yTop: number,
  options?: {
    font?: "regular" | "bold";
    fontSize?: number;
    color?: [number, number, number];
  }
) {
  const fontSize = options?.fontSize ?? TYPE.body.size;
  const startX = rightX - estimateTextWidth(text, fontSize);

  drawText(commands, text, startX, yTop, options);
}

function drawWrappedText(
  commands: string[],
  text: string,
  x: number,
  yTop: number,
  width: number,
  options?: {
    font?: "regular" | "bold";
    fontSize?: number;
    color?: [number, number, number];
    lineGap?: number;
    uppercase?: boolean;
  }
) {
  const fontSize = options?.fontSize ?? TYPE.body.size;
  const lineGap = options?.lineGap ?? TYPE.body.lineGap;
  const normalizedText = options?.uppercase ? text.toUpperCase() : text;
  const lines = wrapText(normalizedText, width, fontSize);
  let currentY = yTop;

  for (const line of lines) {
    drawText(commands, line, x, currentY, options);
    currentY += fontSize + lineGap;
  }

  return lines.length * fontSize + Math.max(0, lines.length - 1) * lineGap;
}

function drawWrappedTextRight(
  commands: string[],
  text: string,
  rightX: number,
  yTop: number,
  width: number,
  options?: {
    font?: "regular" | "bold";
    fontSize?: number;
    color?: [number, number, number];
    lineGap?: number;
  }
) {
  const fontSize = options?.fontSize ?? TYPE.body.size;
  const lineGap = options?.lineGap ?? TYPE.body.lineGap;
  const lines = wrapText(text, width, fontSize);
  let currentY = yTop;

  for (const line of lines) {
    drawRightAlignedText(commands, line, rightX, currentY, options);
    currentY += fontSize + lineGap;
  }

  return lines.length * fontSize + Math.max(0, lines.length - 1) * lineGap;
}

function drawLabel(commands: string[], label: string, x: number, yTop: number, width: number) {
  return drawWrappedText(commands, label, x, yTop, width, {
    font: "bold",
    fontSize: TYPE.label.size,
    color: COLOR_TEXT_MUTED,
    lineGap: TYPE.label.lineGap,
    uppercase: true,
  });
}

function createFieldRows(item: PdfSectionItem) {
  if (item.fields && item.fields.length > 0) {
    return item.fields.map((field) => ({
      ...field,
      value: normalizeVariableValue(field.label, field.value),
    }));
  }

  return [
    {
      label: item.label,
      value: normalizeVariableValue(item.label, item.value ?? "-"),
      emphasis: "default" as const,
    },
  ];
}

async function resolveFontOptions(fonts?: PdfFontOptions) {
  const defaultRegularPath = path.join(process.cwd(), "public", "fonts", "poppins-regular.ttf");
  const defaultBoldPath = path.join(process.cwd(), "public", "fonts", "poppins-bold.ttf");

  const tryRead = async (fontPath?: string, fontBuffer?: Buffer) => {
    if (fontBuffer) {
      return fontBuffer;
    }

    if (!fontPath) {
      return null;
    }

    try {
      await access(fontPath);
      return await readFile(fontPath);
    } catch {
      return null;
    }
  };

  const regularBuffer = await tryRead(
    fonts?.regularPath ?? defaultRegularPath,
    fonts?.regularBuffer
  );
  const boldBuffer = await tryRead(fonts?.boldPath ?? defaultBoldPath, fonts?.boldBuffer);

  return {
    regularBuffer,
    boldBuffer,
    baseFontRegular: "Helvetica",
    baseFontBold: "Helvetica-Bold",
  };
}

function renderMetric(
  commands: string[],
  metric: PdfMetric,
  x: number,
  yTop: number,
  width: number
) {
  drawLabel(commands, metric.label, x, yTop, width);
  drawWrappedText(commands, metric.value, x, yTop + 14, width, {
    font: "bold",
    fontSize: TYPE.dataValue.size,
    color: COLOR_TEXT_PRIMARY,
    lineGap: TYPE.dataValue.lineGap,
  });
}

function estimateMetricHeight(metric: PdfMetric, width: number) {
  return (
    estimateWrappedTextHeight(
      metric.label.toUpperCase(),
      width,
      TYPE.label.size,
      TYPE.label.lineGap
    ) +
    4 +
    estimateWrappedTextHeight(metric.value, width, TYPE.dataValue.size, TYPE.dataValue.lineGap)
  );
}

function drawCard(
  commands: string[],
  x: number,
  yTop: number,
  width: number,
  rows: Array<{ label: string; value: string; emphasis?: "default" | "highlight" }>,
  options?: {
    title?: string;
    subtitle?: string;
  }
) {
  const innerPadding = BASE_GAP;
  const labelColumnWidth = COL_UNIT * 4 - innerPadding;
  const valueColumnWidth = COL_UNIT * 8 - innerPadding;
  const contentWidth = width - innerPadding * 2;
  const labelX = x + innerPadding;
  const valueRightX = x + width - innerPadding;

  const titleHeight = options?.title
    ? estimateWrappedTextHeight(options.title, contentWidth, TYPE.label.size, TYPE.label.lineGap)
    : 0;
  const subtitleHeight = options?.subtitle
    ? estimateWrappedTextHeight(
        normalizeVariableValue(options.title ?? "", options.subtitle),
        contentWidth,
        TYPE.sectionTitle.size,
        TYPE.sectionTitle.lineGap
      )
    : 0;

  const rowHeights = rows.map((row) => {
    const labelHeight = estimateWrappedTextHeight(
      row.label.toUpperCase(),
      labelColumnWidth,
      TYPE.label.size,
      TYPE.label.lineGap
    );
    const valueHeight = estimateWrappedTextHeight(
      row.value,
      valueColumnWidth,
      TYPE.body.size,
      TYPE.body.lineGap
    );

    return Math.max(labelHeight, valueHeight) + 8;
  });

  const totalRowsHeight = rowHeights.reduce((sum, value) => sum + value, 0);
  const cardHeight =
    innerPadding * 2 +
    titleHeight +
    (options?.title ? 4 : 0) +
    subtitleHeight +
    (options?.subtitle ? 10 : 0) +
    totalRowsHeight;

  drawFilledRoundedRect(commands, x, yTop, width, cardHeight, 2, COLOR_SURFACE);
  drawFilledRect(commands, x, yTop, 2, cardHeight, COLOR_ACCENT);

  let contentY = yTop + innerPadding;

  if (options?.title) {
    contentY += drawLabel(commands, options.title, x + innerPadding, contentY, contentWidth);
  }

  if (options?.subtitle) {
    if (options.title) {
      contentY += 4;
    }

    contentY += drawWrappedText(
      commands,
      normalizeVariableValue(options.title ?? "", options.subtitle),
      x + innerPadding,
      contentY,
      contentWidth,
      {
        font: "bold",
        fontSize: TYPE.sectionTitle.size,
        color: COLOR_TEXT_PRIMARY,
        lineGap: TYPE.sectionTitle.lineGap,
      }
    );
    contentY += 10;
  }

  rows.forEach((row, index) => {
    drawLabel(commands, row.label, labelX, contentY, labelColumnWidth);
    drawWrappedTextRight(commands, row.value, valueRightX, contentY, valueColumnWidth, {
      font: row.emphasis === "highlight" ? "bold" : "regular",
      fontSize: TYPE.body.size,
      color: COLOR_TEXT_PRIMARY,
      lineGap: TYPE.body.lineGap,
    });

    contentY += rowHeights[index];
  });

  return cardHeight;
}

function estimateCardHeight(
  width: number,
  rows: Array<{ label: string; value: string; emphasis?: "default" | "highlight" }>,
  options?: {
    title?: string;
    subtitle?: string;
  }
) {
  return drawCard([], 0, 0, width, rows, options);
}

export async function createStyledTenderPdf(
  document: StyledPdfDocument,
  options?: PdfRenderOptions
) {
  const pageCommands: string[][] = [];
  let commands: string[] = [];
  let pageNumber = 1;
  let cursorY = 0;

  const resolvedFonts = await resolveFontOptions(options?.fonts);
  const footerText =
    document.footerNote ||
    "Confidential working paper. Rule-based tender output with AI benchmark support.";

  const startPage = () => {
    commands = [];
    cursorY = PAGE_MARGIN_TOP;
    drawFilledRect(commands, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR_WHITE);
  };

  const finishPage = () => {
    drawWrappedText(
      commands,
      footerText,
      PAGE_MARGIN_X,
      PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 2,
      CONTENT_WIDTH,
      {
        fontSize: 8,
        color: COLOR_TEXT_MUTED,
        lineGap: 3,
      }
    );

    pageCommands.push(commands);
    pageNumber += 1;
  };

  const drawHeader = () => {
    const titleWidth = CONTENT_WIDTH - 140;

    drawWrappedText(commands, document.title, PAGE_MARGIN_X, cursorY, titleWidth, {
      font: "bold",
      fontSize: TYPE.heading.size,
      color: COLOR_TEXT_PRIMARY,
      lineGap: TYPE.heading.lineGap,
      uppercase: true,
    });

    const badgeWidth = 110;
    drawFilledRect(
      commands,
      PAGE_WIDTH - PAGE_MARGIN_X - badgeWidth,
      cursorY + 2,
      badgeWidth,
      20,
      COLOR_TEXT_PRIMARY
    );
    drawText(
      commands,
      document.badge.toUpperCase(),
      PAGE_WIDTH - PAGE_MARGIN_X - badgeWidth + 10,
      cursorY + 8,
      {
        font: "bold",
        fontSize: 8,
        color: COLOR_WHITE,
      }
    );

    const subtitleY = cursorY + 34;
    drawWrappedText(commands, document.subtitle, PAGE_MARGIN_X, subtitleY, CONTENT_WIDTH - 120, {
      fontSize: TYPE.body.size,
      color: COLOR_TEXT_MUTED,
      lineGap: TYPE.body.lineGap,
    });
    drawWrappedText(
      commands,
      `Generated ${document.generatedAt} - Page ${pageNumber}`,
      PAGE_MARGIN_X,
      subtitleY + 18,
      CONTENT_WIDTH,
      {
        fontSize: TYPE.body.size,
        color: COLOR_TEXT_MUTED,
        lineGap: TYPE.body.lineGap,
      }
    );

    const separatorY = cursorY + 68;
    drawLine(
      commands,
      PAGE_MARGIN_X,
      separatorY,
      PAGE_MARGIN_X + CONTENT_WIDTH,
      separatorY,
      COLOR_TEXT_PRIMARY,
      0.5
    );
    cursorY = separatorY + BASE_GAP;
  };

  const ensureSpace = (height: number) => {
    if (cursorY + height <= PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - FOOTER_HEIGHT) {
      return;
    }

    finishPage();
    startPage();
    drawHeader();
  };

  const drawHeroMetrics = () => {
    const metricWidth = COL_UNIT * 3 - BASE_GAP;
    const metricHeight = Math.max(
      ...document.heroMetrics.map((metric) => estimateMetricHeight(metric, metricWidth))
    );

    document.heroMetrics.forEach((metric, index) => {
      const x = PAGE_MARGIN_X + index * COL_UNIT * 3;
      renderMetric(commands, metric, x, cursorY, metricWidth);
    });

    const separatorY = cursorY + metricHeight + BASE_GAP;
    drawLine(
      commands,
      PAGE_MARGIN_X,
      separatorY,
      PAGE_MARGIN_X + CONTENT_WIDTH,
      separatorY,
      COLOR_HAIRLINE,
      0.5
    );
    cursorY = separatorY + SECTION_GAP;
  };

  const drawSection = (section: StyledPdfSection) => {
    const titleHeight = estimateWrappedTextHeight(
      section.title,
      CONTENT_WIDTH,
      TYPE.sectionTitle.size,
      TYPE.sectionTitle.lineGap
    );
    const descriptionHeight = section.description
      ? estimateWrappedTextHeight(
          section.description,
          CONTENT_WIDTH,
          TYPE.body.size,
          TYPE.body.lineGap
        )
      : 0;
    const simpleSection = section.items.every((item) => !item.fields && !item.subtitle);

    let firstCardHeight = 0;

    if (section.items.length > 0) {
      if (simpleSection && section.columns === 2) {
        const cardWidth = COL_UNIT * 6 - BASE_GAP / 2;
        const rowItems = section.items.slice(0, 2);
        firstCardHeight = Math.max(
          ...rowItems.map((item) => estimateCardHeight(cardWidth, createFieldRows(item)))
        );
      } else if (simpleSection) {
        firstCardHeight = estimateCardHeight(CONTENT_WIDTH, createFieldRows(section.items[0]));
      } else {
        const firstItem = section.items[0];
        firstCardHeight = estimateCardHeight(CONTENT_WIDTH, createFieldRows(firstItem), {
          title: firstItem.label,
          subtitle: firstItem.subtitle,
        });
      }
    }

    ensureSpace(titleHeight + descriptionHeight + 16 + firstCardHeight);

    drawWrappedText(commands, section.title, PAGE_MARGIN_X, cursorY, CONTENT_WIDTH, {
      font: "bold",
      fontSize: TYPE.sectionTitle.size,
      color: COLOR_TEXT_PRIMARY,
      lineGap: TYPE.sectionTitle.lineGap,
    });
    cursorY += titleHeight;

    if (section.description) {
      cursorY += 6;
      cursorY += drawWrappedText(
        commands,
        section.description,
        PAGE_MARGIN_X,
        cursorY,
        CONTENT_WIDTH,
        {
          fontSize: TYPE.body.size,
          color: COLOR_TEXT_MUTED,
          lineGap: TYPE.body.lineGap,
        }
      );
    }

    cursorY += BASE_GAP;

    if (simpleSection && section.columns === 2) {
      const cardWidth = COL_UNIT * 6 - BASE_GAP / 2;

      for (let index = 0; index < section.items.length; index += 2) {
        const rowItems = section.items.slice(index, index + 2);
        const heights = rowItems.map((item) =>
          drawCard([], 0, 0, cardWidth, createFieldRows(item))
        );
        const rowHeight = Math.max(...heights);

        ensureSpace(rowHeight);

        rowItems.forEach((item, columnIndex) => {
          const x = PAGE_MARGIN_X + columnIndex * (cardWidth + BASE_GAP);
          drawCard(commands, x, cursorY, cardWidth, createFieldRows(item));
        });

        cursorY += rowHeight + BASE_GAP;
      }
    } else if (simpleSection) {
      for (const item of section.items) {
        const height = drawCard(
          commands,
          PAGE_MARGIN_X,
          cursorY,
          CONTENT_WIDTH,
          createFieldRows(item)
        );
        cursorY += height + BASE_GAP;
      }
    } else {
      for (const item of section.items) {
        const height = drawCard(
          commands,
          PAGE_MARGIN_X,
          cursorY,
          CONTENT_WIDTH,
          createFieldRows(item),
          {
            title: item.label,
            subtitle: item.subtitle,
          }
        );
        cursorY += height + BASE_GAP;
      }
    }

    const separatorY = cursorY + 2;
    drawLine(
      commands,
      PAGE_MARGIN_X,
      separatorY,
      PAGE_MARGIN_X + CONTENT_WIDTH,
      separatorY,
      COLOR_HAIRLINE,
      0.5
    );
    cursorY = separatorY + 24;
  };

  startPage();
  drawHeader();
  drawHeroMetrics();

  for (const section of document.sections) {
    drawSection(section);
  }

  finishPage();

  const objects: Buffer[] = [];
  const addObject = (content: Buffer | string) => {
    objects.push(Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"));
    return objects.length;
  };

  const fontObjectId = addObject(
    `<< /Type /Font /Subtype /Type1 /BaseFont /${resolvedFonts.baseFontRegular} >>`
  );
  const boldFontObjectId = addObject(
    `<< /Type /Font /Subtype /Type1 /BaseFont /${resolvedFonts.baseFontBold} >>`
  );
  const pageObjectIds: number[] = [];

  for (const pageStream of pageCommands) {
    const streamBuffer = Buffer.from(pageStream.join("\n"), "utf8");
    const contentObjectId = addObject(
      Buffer.concat([
        Buffer.from(`<< /Length ${streamBuffer.length} >>\nstream\n`, "utf8"),
        streamBuffer,
        Buffer.from("\nendstream", "utf8"),
      ])
    );

    const pageObjectId = addObject(
      `<< /Type /Page /Parent {{PAGES}} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentObjectId} 0 R /Resources << /Font << /F1 ${fontObjectId} 0 R /F2 ${boldFontObjectId} 0 R >> >> >>`
    );

    pageObjectIds.push(pageObjectId);
  }

  const pagesObjectId = addObject(
    `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>`
  );
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  const finalizedObjects = objects.map((objectBuffer) =>
    Buffer.from(
      objectBuffer.toString("utf8").replaceAll("{{PAGES}}", String(pagesObjectId)),
      "utf8"
    )
  );

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "utf8")];
  const offsets: number[] = [];
  let currentLength = chunks[0].length;

  finalizedObjects.forEach((objectBuffer, index) => {
    offsets.push(currentLength);
    const prefix = Buffer.from(`${index + 1} 0 obj\n`, "utf8");
    const suffix = Buffer.from("\nendobj\n", "utf8");
    chunks.push(prefix, objectBuffer, suffix);
    currentLength += prefix.length + objectBuffer.length + suffix.length;
  });

  const xrefOffset = currentLength;
  const xrefLines = [
    `xref\n0 ${finalizedObjects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${finalizedObjects.length + 1} /Root ${catalogObjectId} 0 R >>\n`,
    `startxref\n${xrefOffset}\n%%EOF`,
  ];

  chunks.push(Buffer.from(xrefLines.join(""), "utf8"));

  return Buffer.concat(chunks);
}
