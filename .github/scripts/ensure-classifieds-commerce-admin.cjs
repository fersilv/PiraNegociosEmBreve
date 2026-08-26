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

patch('pages/DashboardRouter.tsx', (input) => {
  let source = input;
  if (!source.includes('AdminClassifiedCommercePage')) {
    source = source.replace(
      'import { AdminPaymentsPage } from "./AdminPaymentsPage";',
      'import { AdminPaymentsPage } from "./AdminPaymentsPage";\nimport AdminClassifiedCommercePage from "./AdminClassifiedCommercePage";',
    );
  }
  if (!source.includes('path="pagamentos/classificados"')) {
    source = source.replace(
      '<Route path="pagamentos" element={<AdminPage><AdminPaymentsPage /></AdminPage>} />',
      '<Route path="pagamentos" element={<AdminPage><AdminPaymentsPage /></AdminPage>} />\n      <Route path="pagamentos/classificados" element={<AdminPage><AdminClassifiedCommercePage /></AdminPage>} />',
    );
  }
  if (!source.includes('AdminClassifiedCommercePage')) throw new Error('Could not wire AdminClassifiedCommercePage import.');
  if (!source.includes('path="pagamentos/classificados"')) throw new Error('Could not wire classifieds commerce admin route.');
  return source;
});

patch('components/AdminWorkspaceLayout.tsx', (input) => {
  let source = input;
  if (!source.includes('to: "/admin/pagamentos/classificados"')) {
    source = source.replace(
      '{ to: "/admin/pagamentos", label: "Pagamentos", icon: <CreditCard className="h-4 w-4" />, end: true },',
      '{ to: "/admin/pagamentos", label: "Pagamentos", icon: <CreditCard className="h-4 w-4" />, end: true },\n      { to: "/admin/pagamentos/classificados", label: "Comissões Classificados", icon: <BadgeDollarSign className="h-4 w-4" /> },',
    );
  }
  if (!source.includes('label="Comissões Classificados"')) {
    source = source.replace(
      '<MoreLink to="/admin/pagamentos" icon={<CreditCard className="h-4 w-4" />} label="Pagamentos" close={() => setMoreOpen(false)} />',
      '<MoreLink to="/admin/pagamentos" icon={<CreditCard className="h-4 w-4" />} label="Pagamentos" close={() => setMoreOpen(false)} />\n              <MoreLink to="/admin/pagamentos/classificados" icon={<BadgeDollarSign className="h-4 w-4" />} label="Comissões Classificados" close={() => setMoreOpen(false)} />',
    );
  }
  if (!source.includes('to: "/admin/pagamentos/classificados"')) throw new Error('Could not wire classifieds commerce admin nav.');
  if (!source.includes('label="Comissões Classificados"')) throw new Error('Could not wire classifieds commerce mobile admin nav.');
  return source;
});

console.log('Classifieds commerce admin navigation verified.');
