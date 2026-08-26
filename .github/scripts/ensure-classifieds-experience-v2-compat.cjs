const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
process.chdir(root);

const file = 'components/classifieds/ClassifiedsWorkspaceLayout.tsx';
let source = fs.readFileSync(file, 'utf8');
const original = source;

// Compatibility for checkouts left partially mutated by older prebuild runs.
// Older v2 already added the classified workspace icons, but predates the
// Business Sales module and therefore has no ShoppingCart import.
const intermediateImport = "import { BadgeCheck, BadgeDollarSign, BarChart3, Briefcase, Building2, ChevronDown, Compass, Gavel, Home, LogOut, Menu, MessageCircle, Plus, Settings2, Store, User, Wrench, X } from 'lucide-react';";
const finalImport = "import { BadgeCheck, BadgeDollarSign, BarChart3, Briefcase, Building2, ChevronDown, Compass, Gavel, Home, LogOut, Menu, MessageCircle, Plus, Settings2, ShoppingCart, Store, User, Wrench, X } from 'lucide-react';";
if (source.includes(intermediateImport) && !source.includes(finalImport)) {
  source = source.replace(intermediateImport, finalImport);
}

// Older v2 also had the internal nav already expanded, but before the Sales
// workspace existed. Add Sales only to that known intermediate nav shape.
const analyticsLine = "    { to: '/classificados/analytics', label: 'Analytics', icon: <BarChart3 className=\"h-5 w-5\" /> },";
const salesLine = "    ...(business ? [{ to: '/classificados/vendas', label: 'Vendas', icon: <ShoppingCart className=\"h-5 w-5\" /> }] : []),";
if (source.includes(analyticsLine) && !source.includes("to: '/classificados/vendas'")) {
  source = source.replace(analyticsLine, `${analyticsLine}\n${salesLine}`);
}

if (source !== original) {
  fs.writeFileSync(file, source);
  console.log(`updated ${file} from an intermediate Classifieds v2 checkout`);
}
console.log('Classifieds v2 compatibility state verified.');
