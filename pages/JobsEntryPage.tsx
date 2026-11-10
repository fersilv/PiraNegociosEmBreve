import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CitySeoLinks } from "../components/CitySeoLinks";
import { RegionalLoader } from "../components/RegionalLoader";
import JobsPage from "./JobsPage";

export default function JobsEntryPage() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <RegionalLoader context="jobs" className="min-h-screen" />;
  }

  // Browsing job openings is public. A newly authenticated person may not have
  // completed phone/profile onboarding yet; do not trap them on onboarding
  // merely for visiting /vagas. They can still enter the personalized area later.
  if (user && profile?.type !== "ADMIN" && profile?.phone?.trim()) {
    return <Navigate to="/user/vagas" replace />;
  }

  return (
    <>
      <JobsPage />
      <CitySeoLinks />
    </>
  );
}