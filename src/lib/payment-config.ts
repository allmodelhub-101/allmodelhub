export function getManualPaymentMethods() {
  return [
    {
      id: "easypaisa",
      label: "Easypaisa",
      accountTitle: process.env.EASYPAISA_ACCOUNT_TITLE || "Configure in Vercel",
      accountNumber: process.env.EASYPAISA_ACCOUNT_NUMBER || "Not configured",
      instructions: "Transfer the exact amount, then submit the transaction ID and payment proof."
    },
    {
      id: "meezan",
      label: "Meezan Bank",
      accountTitle: process.env.MEEZAN_ACCOUNT_TITLE || "Configure in Vercel",
      accountNumber: process.env.MEEZAN_ACCOUNT_NUMBER || "Not configured",
      iban: process.env.MEEZAN_IBAN || "Not configured",
      instructions: "Transfer the exact amount, then submit the bank reference and payment proof."
    }
  ] as const;
}
