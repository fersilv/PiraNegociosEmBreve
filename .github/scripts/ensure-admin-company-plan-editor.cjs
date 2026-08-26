const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

const file = 'pages/AdminDashboard.tsx';
let source = fs.readFileSync(file, 'utf8');
const original = source;

if (!source.includes('AdminCompanyPlanEditor')) {
  const importAnchor = 'import { CityStateSelector } from "../components/CityStateSelector";';
  if (!source.includes(importAnchor)) throw new Error('Admin company plan editor import anchor not found.');
  source = source.replace(
    importAnchor,
    `${importAnchor}\nimport { AdminCompanyPlanEditor } from "../components/AdminCompanyPlanEditor";`,
  );
}

if (!source.includes('<AdminCompanyPlanEditor companyId={companyDetail.company.id}')) {
  const modalAnchor = '          <div className="space-y-5 text-sm">\n            <form';
  if (!source.includes(modalAnchor)) throw new Error('Admin company plan editor modal anchor not found.');
  source = source.replace(
    modalAnchor,
    '          <div className="space-y-5 text-sm">\n            <AdminCompanyPlanEditor companyId={companyDetail.company.id} companyName={companyDetail.company.name} />\n            <form',
  );
}

if (!source.includes('import { AdminCompanyPlanEditor }')) throw new Error('Admin company plan editor import was not applied.');
if (!source.includes('<AdminCompanyPlanEditor companyId={companyDetail.company.id}')) throw new Error('Admin company plan editor was not mounted.');

if (source !== original) {
  fs.writeFileSync(file, source);
  console.log(`updated ${file}`);
}
console.log('Admin company plan editor verified.');
