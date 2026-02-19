export default function Loading({ text = "Loader…" }) {
  return (
    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10, opacity: 0.85 }}>
      {text}
    </div>
  );
}
