export type InlinePaymentRequirement = {
  productCode: string;
  product?: any;
  message?: string;
};

type ActiveRequirement = InlinePaymentRequirement & {
  key: string;
};

type Listener = (state: ActiveRequirement | null) => void;
type Waiter = { resolve: () => void; reject: (reason?: unknown) => void };

let active: ActiveRequirement | null = null;
let waiters: Waiter[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(active);
}

export function subscribeInlinePayment(listener: Listener) {
  listeners.add(listener);
  listener(active);
  return () => listeners.delete(listener);
}

export function getInlinePaymentRequirement() {
  return active;
}

export function requestInlinePayment(requirement: InlinePaymentRequirement): Promise<void> {
  const productCode = String(requirement.productCode || requirement.product?.code || '').trim();
  if (!productCode) return Promise.reject(new Error('O backend solicitou pagamento sem informar o produto.'));

  if (active && active.productCode !== productCode) {
    return Promise.reject(new Error('Já existe outro pagamento em andamento. Conclua ou feche a cobrança atual.'));
  }

  if (!active) {
    active = {
      ...requirement,
      productCode,
      key: `${productCode}:${Date.now()}`,
    };
    emit();
  }

  return new Promise<void>((resolve, reject) => {
    waiters.push({ resolve, reject });
  });
}

export function completeInlinePayment() {
  const pending = waiters;
  waiters = [];
  active = null;
  emit();
  for (const waiter of pending) waiter.resolve();
}

export function cancelInlinePayment() {
  const pending = waiters;
  waiters = [];
  active = null;
  emit();
  const error = new Error('Pagamento cancelado pelo usuário.');
  for (const waiter of pending) waiter.reject(error);
}
