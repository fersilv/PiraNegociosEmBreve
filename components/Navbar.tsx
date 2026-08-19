import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Navbar() {
  const { user } = useAuth();
  return (
    <nav className="w-full bg-white border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="font-serif font-bold text-xl text-terracotta-800"
        >
          PiraNegócios
        </Link>
        <div className="flex gap-4 items-center">
          <Link
            to="/termos"
            className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
          >
            Termos
          </Link>
          {user ? (
            <Link
              to="/dashboard"
              className="text-sm font-bold bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
            >
              Meu Painel
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-sm font-bold bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
