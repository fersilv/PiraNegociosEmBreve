const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);
const file = 'pages/ClassifiedPublishPage.tsx';
let source = fs.readFileSync(file, 'utf8');
const original = source;

function swap(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`Classifieds experience v2 final missing ${label}`);
  source = source.replace(from, to);
}

swap(
  `        {step === 2 && <PhotosStep images={form.images} uploading={uploading} uploadImages={uploadImages} remove={(index) => patch('images', form.images.filter((_, itemIndex) => itemIndex !== index))} />}`,
  `        {step === 2 && <PhotosStep images={form.images} photoLimit={photoLimit} uploading={uploading} uploadImages={uploadImages} remove={(index) => patch('images', form.images.filter((_, itemIndex) => itemIndex !== index))} />}`,
  'PhotosStep photoLimit prop',
);

swap(
  `function PhotosStep({ images, uploading, uploadImages, remove }: { images: string[]; uploading: boolean; uploadImages: (files: FileList | null) => void; remove: (index: number) => void })`,
  `function PhotosStep({ images, photoLimit, uploading, uploadImages, remove }: { images: string[]; photoLimit: number; uploading: boolean; uploadImages: (files: FileList | null) => void; remove: (index: number) => void })`,
  'PhotosStep signature',
);

swap('{images.length < 12 && <label', '{images.length < photoLimit && <label', 'photo add button entitlement');
swap('Até 12 imagens, máximo de 10 MB por arquivo.', 'Até {photoLimit} {photoLimit === 1 ? \'imagem\' : \'imagens\'}, máximo de 10 MB por arquivo.', 'photo entitlement helper');

swap(
  `      const response = await api.post(\`/classifieds/me/listings/\${id}/publish\`);\n      navigate(\`/classificados/anuncio/\${response.data.slug}\`);`,
  `      const response = await api.post(\`/classifieds/me/listings/\${id}/publish\`);\n      if (response.data?.status === 'PAUSED' && response.data?.moderationReason) {\n        navigate('/classificados/anuncios', { replace: true, state: { moderationNotice: response.data.moderationReason } });\n        return;\n      }\n      navigate(\`/classificados/explorar/\${response.data.slug}\`);`,
  'internal publish destination',
);

if (source !== original) {
  fs.writeFileSync(file, source);
  console.log(`updated ${file}`);
}
console.log('Classifieds experience v2 final verified.');
