/** Renders question text that may contain <sub>/<sup>/<b>/<i>/<br>. Everything else is escaped. */
export function sanitize(html: string): string {
  const escaped = (html || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/&lt;(\/?)(sub|sup|b|i|strong|em)&gt;/gi, '<$1$2>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/&lt;\/?p&gt;/gi, ' ');
}

export default function Rich({ html, className = '' }: { html: string; className?: string }) {
  return <span className={`rich ${className}`} dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;
}
