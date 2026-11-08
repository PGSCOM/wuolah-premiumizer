// Quita los anuncios de un PDF gratuito de Wuolah.
// Wuolah genera el PDF con pdf-lib: el contenido original de cada página queda
// envuelto entre dos streams compartidos por todo el documento ("q" ... "Q").
// Todo lo de fuera (escalado para hacer hueco, banners, marcas, enlaces de
// tracking) es suyo. Las páginas sin ese envoltorio (portada, anuncios a página
// completa) se descartan.
async function premiumize(bytes, PDFLib) {
  const { PDFDocument, PDFArray, PDFName, PDFRawStream, PDFDict, decodePDFRawStream } = PDFLib;
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const ctx = src.context;
  const text = (ref) => {
    const s = ctx.lookup(ref);
    if (!(s instanceof PDFRawStream)) return null;
    return new TextDecoder('latin1').decode(decodePDFRawStream(s).decode());
  };
  const refsOf = (page) => {
    const c = page.node.get(PDFName.of('Contents'));
    return c instanceof PDFArray ? c.asArray() : c ? [c] : [];
  };

  // El "q" y el "Q" marcadores son el mismo objeto en todas las páginas: el más repetido.
  const pages = src.getPages();
  const count = (body) => {
    const n = new Map();
    for (const p of pages) for (const r of new Set(refsOf(p)))
      if (text(r)?.trim() === body) n.set(r.toString(), (n.get(r.toString()) || 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const push = count('q'), pop = count('Q');
  if (!push || !pop) throw new Error('No parece un PDF gratuito de Wuolah.');

  const keep = [];
  pages.forEach((page, i) => {
    const refs = refsOf(page);
    const a = refs.findIndex((r) => r.toString() === push);
    const b = refs.findIndex((r, j) => j > a && r.toString() === pop);
    if (a < 0 || b < 0) return; // portada o anuncio a página completa
    const inner = refs.slice(a + 1, b);
    page.node.set(PDFName.of('Contents'), ctx.obj(inner));
    page.node.delete(PDFName.of('Annots')); // solo son enlaces de tracking

    // Quita recursos que el contenido original no usa (imágenes de anuncios, fuentes de Wuolah).
    const used = inner.map(text).join('\n');
    const res = page.node.Resources();
    for (const kind of ['XObject', 'Font', 'ExtGState']) {
      const d = res?.lookup(PDFName.of(kind));
      if (!(d instanceof PDFDict)) continue;
      // ponytail: includes() puede dar falsos positivos (/X7 en /X70); solo deja algún recurso de más.
      for (const k of d.keys()) if (!used.includes(k.asString())) d.delete(k);
    }
    keep.push(i);
  });
  if (!keep.length) throw new Error('No se ha encontrado contenido original en el PDF.');

  const out = await PDFDocument.create();
  for (const p of await out.copyPages(src, keep)) out.addPage(p);
  const title = src.getTitle();
  if (title) out.setTitle(title);
  return {
    bytes: await out.save(),
    total: pages.length,
    kept: keep,
  };
}

if (typeof module !== 'undefined') module.exports = premiumize;
