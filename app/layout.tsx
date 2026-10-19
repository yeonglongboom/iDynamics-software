import "./style.css";
export const metadata = {
  title: "iDynamics | Quotation Checker",
  description: "Internal quotation review workspace",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
