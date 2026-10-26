export function usernameEmail(value) {
  const name = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(name))
    throw Error(
      "Username must be 3–32 characters: start with a letter, then letters, digits, dots, underscores or hyphens.",
    );
  return `${name}@accounts.internal.invalid`;
}
export function validatePassword(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    throw Error("Use a password between 12 and 128 characters.");
  return value;
}
