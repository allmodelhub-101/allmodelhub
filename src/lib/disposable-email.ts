const disposableFragments = [
  "mailinator.", "tempmail.", "10minutemail.", "guerrillamail.", "throwawaymail.", "yopmail.", "temp-mail.", "fakeinbox."
];

export function looksDisposable(email?: string | null) {
  if (!email) return true;
  const value = email.toLowerCase();
  return disposableFragments.some((fragment) => value.includes(fragment));
}
