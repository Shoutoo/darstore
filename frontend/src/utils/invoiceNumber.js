export function generateInvoiceNumber() {
  const randomStr = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `DS${randomStr}`;
}
