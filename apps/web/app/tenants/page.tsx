"use client";
import { useEffect } from "react";

export default function TenantsRedirect() {
  useEffect(() => {
    window.location.replace("/dashboard/tenants");
  }, []);
  return null;
}
