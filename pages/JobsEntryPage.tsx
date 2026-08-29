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

  if (user && profile?.type !== "ADMIN") {
    return <Navigate to="/user/vagas" replace />;
  }

  return (
    <>
      <JobsPage />
      <CitySeoLinks />
    </>
  );
}
