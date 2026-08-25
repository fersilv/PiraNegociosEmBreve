export async function preparePdfForAi(
  base64: string,
  maxPages = 8,
): Promise<{ text: string; images: string[] }> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({
    data: new Uint8Array(Buffer.from(base64, 'base64')),
  });

  try {
    const textResult = await parser.getText({ first: maxPages });
    const text = String(textResult?.text || '')
      .replace(/\u0000/g, '')
      .trim()
      .slice(0, 220_000);

    if (text.length >= 120) return { text, images: [] };

    const screenshots = await parser.getScreenshot({
      first: maxPages,
      desiredWidth: 1400,
      imageBuffer: true,
      imageDataUrl: false,
    });
    const images = (screenshots?.pages || [])
      .map((page: any) => {
        if (!page?.data) return '';
        return `data:image/png;base64,${Buffer.from(page.data).toString('base64')}`;
      })
      .filter(Boolean);

    return { text, images };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
