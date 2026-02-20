"use client";

export default function SmallButton({ children, className = "", ...props }) {
  const cls = ["pillBtn", className].filter(Boolean).join(" ");
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
