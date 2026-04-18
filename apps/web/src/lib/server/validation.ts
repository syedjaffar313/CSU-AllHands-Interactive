export function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s\-.,!?']/g, '')
    .trim()
    .slice(0, 200);
}
