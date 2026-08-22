import React from "react";
import type { UserProfile } from "../../contexts/AuthContext";

export function getResumePersonalDetails(profile: UserProfile): string[] {
  const preferences = profile.jobPreferences;
  if (!preferences) return [];

  const details: string[] = [];

  if (preferences.hasDriverLicense === true) {
    const categories = (preferences.driverLicenseCategories || [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    details.push(
      categories.length > 0
        ? `CNH ${categories.join("/")}`
        : "Possui CNH",
    );
  }

  if (preferences.hasOwnVehicle === true) {
    const vehicles = (preferences.ownVehicles || [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    details.push(
      vehicles.length > 0
        ? `Veículo próprio: ${vehicles.join(", ")}`
        : "Possui veículo próprio",
    );
  }

  if (
    preferences.pcdDeclaration === "YES" &&
    preferences.pcdDataConsent === true
  ) {
    details.push("Pessoa com deficiência (PcD)");
  }

  return details;
}

export function ResumePersonalDetails({
  profile,
  className = "",
  itemClassName = "",
  separator = " • ",
}: {
  profile: UserProfile;
  className?: string;
  itemClassName?: string;
  separator?: string;
}) {
  const details = getResumePersonalDetails(profile);
  if (!details.length) return null;

  return (
    <div className={className}>
      {details.map((detail, index) => (
        <React.Fragment key={detail}>
          {index > 0 && separator}
          <span className={itemClassName}>{detail}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
