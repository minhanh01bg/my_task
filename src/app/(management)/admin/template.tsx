export default function AdminTemplate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="desktop-page-enter">{children}</div>;
}
