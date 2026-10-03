export function getManualPaymentMethods() {
  const methods = [
    {
      id: "easypaisa",
      label: "Easypaisa",
      accountTitle: process.env.EASYPAISA_ACCOUNT_TITLE || "",
      accountNumber: process.env.EASYPAISA_ACCOUNT_NUMBER || "",
      instructions: "Transfer the exact amount, then submit the transaction ID and payment proof."
    },
    {
      id: "meezan",
      label: "Meezan Bank",
      accountTitle: process.env.MEEZAN_ACCOUNT_TITLE || "",
      accountNumber: process.env.MEEZAN_ACCOUNT_NUMBER || "",
      iban: process.env.MEEZAN_IBAN || "",
      instructions: "Transfer the exact amount, then submit the bank reference and payment proof."
    }
  ] as const;
  return methods.filter((method) => Boolean(method.accountTitle && method.accountNumber && (method.id !== "meezan" || method.iban)));
}
