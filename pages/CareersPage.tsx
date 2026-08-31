import React from "react";
import { SeoHead } from "../components/SeoHead";
import Home from "./Home";

export default function CareersPage() {
  return (
    <>
      <Home />
      <SeoHead
        title="Carreiras | PiraNegócios"
        description="Encontre vagas na região, crie seu currículo e conecte sua carreira às empresas pelo PiraNegócios."
        canonical={`${window.location.origin}/carreiras`}
      />
    </>
  );
}
