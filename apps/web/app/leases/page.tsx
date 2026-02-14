"use client";
import { useEffect } from "react";

export default function LeasesRedirect() {
  useEffect(() => {
    window.location.replace("/dashboard/leases");
  }, []);
  return null;
}
