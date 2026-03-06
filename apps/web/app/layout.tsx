export const metadata = {
  title: "RentalOS",
  description: "RentalOS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {/* Global style tokens (Design System v1) */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root{
                --bg:#f9fafb;
                --card:#ffffff;
                --border:#e5e7eb;
                --text:#0f172a;
                --muted:#64748b;
                --primary:#3b82f6;
                --primary-ghost:rgba(59,130,246,0.10);
                --primary-border:rgba(59,130,246,0.25);
                --success:#16a34a;
                --warning:#f59e0b;
                --danger:#ef4444;
                --shadow:0 1px 1px rgba(0,0,0,0.04);
                --radius:14px;
              }
              *{box-sizing:border-box}
              html,body{height:100%}
              body{
                margin:0;
                background:var(--bg);
                color:var(--text);
                font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
              }
              a{color:inherit;text-decoration:none}
              button,input,select,textarea{font:inherit}
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}