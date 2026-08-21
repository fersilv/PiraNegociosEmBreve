import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import JobsPage from "./JobsPage";

export default function JobsEntryPage() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">
        Carregando oportunidades...
      </div>
    );
  }

  if (user && profile?.type !== "ADMIN") {
    return <Navigate to="/user/vagas" replace />;
  }

  return <JobsPage />;
}
