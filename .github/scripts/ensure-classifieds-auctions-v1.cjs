const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`updated ${file}`);
  }
}

patch('pages/ClassifiedPublishPage.tsx', (input) => {
  let source = input;
  source = source.replace('const [photoLimit, setPhotoLimit] = useState(1);', 'const [photoLimit, setPhotoLimit] = useState(3);');
  source = source.replace(
    "setPhotoLimit(Math.max(1, Math.min(6, Number(response.data?.photoLimit) || 1)))",
    "setPhotoLimit(Math.max(3, Math.min(10, Number(response.data?.photoLimit) || 3)))",
  );
  source = source.replace('.catch(() => setPhotoLimit(1));', '.catch(() => setPhotoLimit(3));');
  source = source.replace(
    "photoLimit === 1 ? 'O plano Free permite 1 foto por anúncio. Planos pagos permitem até 6.' : `Você pode enviar até ${photoLimit} fotos.`",
    "photoLimit <= 3 ? 'O plano Free permite até 3 fotos por anúncio. Empresas podem usar até 10.' : `Você pode enviar até ${photoLimit} fotos.`",
  );
  source = source.replace(
    "{photoLimit === 1 ? 'Planos pagos Business liberam até 6 fotos.' : `Seu plano permite até ${photoLimit} fotos.`}",
    "{photoLimit <= 3 ? 'Empresas podem publicar até 10 fotos por anúncio.' : `Este workspace permite até ${photoLimit} fotos.`}",
  );
  return source;
});

patch('components/classifieds/ClassifiedsWorkspaceLayout.tsx', (input) => {
  let source = input;
  source = source.replace(
    'BadgeDollarSign, BarChart3, Briefcase, Building2,',
    'BadgeDollarSign, BarChart3, Briefcase, Building2, Gavel,',
  );
  if (!source.includes("to: '/classificados/leiloes'")) {
    source = source.replace(
      `{ to: '/classificados/ofertas', label: 'Ofertas', icon: <BadgeDollarSign className=\"h-5 w-5\" /> },`,
      `{ to: '/classificados/ofertas', label: 'Ofertas', icon: <BadgeDollarSign className=\"h-5 w-5\" /> },\n    { to: '/classificados/leiloes', label: 'Leilões', icon: <Gavel className=\"h-5 w-5\" /> },`,
    );
  }
  return source;
});

console.log('Classifieds auctions v1 and 3/10 photo limits verified.');
