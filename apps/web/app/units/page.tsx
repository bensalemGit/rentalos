"use client";
import { useEffect } from "react";

export default function UnitsRedirect() {
  useEffect(() => {
    window.location.replace("/dashboard/units");
  }, []);
  return null;
}
