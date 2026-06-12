export function Breadcrumbs({ items }: { items: string[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-text-muted">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="flex items-center gap-2">
          {index > 0 ? <span>/</span> : null}
          <span className={index === items.length - 1 ? "text-text-soft" : ""}>{item}</span>
        </span>
      ))}
    </nav>
  );
}
