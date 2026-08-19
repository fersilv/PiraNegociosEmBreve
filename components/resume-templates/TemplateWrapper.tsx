import React from "react";
import { UserProfile } from "../../contexts/AuthContext";

export interface TemplateProps {
  profile: UserProfile;
  color?: string;
  showPhoto?: boolean;
  address?: string; // Optional field added per user request
}

export function TemplateWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-white mx-auto shadow-sm border border-stone-200 print:border-none print:shadow-none"
      style={{
        width: "210mm",
        minHeight: "297mm",
        boxSizing: "border-box",
        pageBreakAfter: "auto",
      }}
    >
      {children}
    </div>
  );
}
