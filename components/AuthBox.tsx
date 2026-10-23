export default function AuthBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="box">
        <img src="/BPL-Stacked-FullColour.svg" alt="Bryce Performance Lab" />
        <h1 style={{ fontSize: 22, textAlign: "center" }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}
